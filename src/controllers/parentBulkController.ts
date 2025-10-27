import { Response } from 'express';
import { supabase, supabaseAdmin } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import csv from 'csv-parser';
import { Readable } from 'stream';

interface ParentCSVData {
  misId: string;
  forename: string;
  legalSurname: string;

  primaryEmail: string;
}

interface CreateParentRequest {
  misId: string;
  forename: string;
  legalSurname: string;
  primaryEmail: string;
}

/**
 * Create a single parent from CSV data
 */
const createParentFromData = async (parentData: ParentCSVData) => {
  const { misId, forename, legalSurname, primaryEmail } = parentData;

  // Validation
  if (!forename || !legalSurname || !primaryEmail) {
    throw new Error('Missing required fields: forename, legalSurname, primaryEmail');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(primaryEmail)) {
    throw new Error(`Invalid email format: ${primaryEmail}`);
  }

  // Generate username and email for parent account
  const username = `${forename.toLowerCase()}.${legalSurname.toLowerCase()}`;
  const parentEmail = `${username}@parent.school.com`;

  // Check if parent already exists by email
  const { data: existingParent, error: existingError } = await supabase
    .from('parents')
    .select('id, first_name, last_name, email')
    .eq('email', parentEmail)
    .single();

  let parentResult;
  let action = 'created';

  if (existingParent && !existingError) {
    // Parent exists, update their details
    console.log(`Updating existing parent with email: ${parentEmail}`);
    
    const { data: updatedParent, error: updateError } = await supabase
      .from('parents')
      .update({
        first_name: forename,
        last_name: legalSurname,
        email: parentEmail
      })
      .eq('id', existingParent.id)
      .select('*')
      .single();

    if (updateError) {
      throw new Error(`Failed to update parent: ${updateError.message}`);
    }

    parentResult = updatedParent;
    action = 'updated';
  } else {
    // Parent doesn't exist, create new one
    console.log(`Creating new parent with email: ${parentEmail}`);

    // Create Supabase Auth user (requires admin privileges)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: parentEmail,
      password: 'test1234',
      email_confirm: true,
      user_metadata: {
        first_name: forename,
        last_name: legalSurname,
        role: 'parent'
      }
    });

    if (authError || !authUser.user) {
      throw new Error(`Failed to create auth user: ${authError?.message || 'Unknown error'}`);
    }

    // Create parent record
    const { data: newParent, error: parentError } = await supabase
      .from('parents')
      .insert({
        auth_user_id: authUser.user.id,
        first_name: forename,
        last_name: legalSurname,
        email: parentEmail,
        status: 'active'
      })
      .select('*')
      .single();

    if (parentError) {
      // If parent creation fails, clean up the auth user (requires admin privileges)
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      throw new Error(`Failed to create parent record: ${parentError.message}`);
    }

    parentResult = newParent;
  }

  // If MIS ID is provided, try to link with student
  let studentResult = null;
  let relationshipResult = null;

  if (misId && misId.trim() !== '') {
    // Find student by admission_no (MIS ID)
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_no')
      .eq('admission_no', misId.trim())
      .single();

    if (student && !studentError) {
      // Check if relationship already exists
      const { data: existingRelationship, error: relCheckError } = await supabase
        .from('parent_student_relationships')
        .select('id')
        .eq('parent_id', parentResult.id)
        .eq('student_id', student.id)
        .single();

      if (!existingRelationship && !relCheckError) {
        // Create parent-student relationship
        const { data: relationship, error: relError } = await supabase
          .from('parent_student_relationships')
          .insert({
            parent_id: parentResult.id,
            student_id: student.id
          })
          .select('*')
          .single();

        if (relError) {
          console.warn(`Failed to create parent-student relationship: ${relError.message}`);
        } else {
          relationshipResult = relationship;
          console.log(`Linked parent ${parentResult.id} with student ${student.id} (MIS ID: ${misId})`);
        }
      } else {
        console.log(`Parent-student relationship already exists for parent ${parentResult.id} and student ${student.id}`);
      }

      studentResult = student;
    } else {
      console.warn(`No student found with MIS ID: ${misId}`);
    }
  }

  return {
    parent: parentResult,
    student: studentResult,
    relationship: relationshipResult,
    action: action,
    linked: !!studentResult
  };
};

/**
 * Create a single parent from CSV data
 */
export const createParentFromCSV = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      misId,
      forename,
      legalSurname,
      primaryEmail
    }: CreateParentRequest = req.body;

    const result = await createParentFromData({
      misId,
      forename,
      legalSurname,
      primaryEmail
    });

    return res.status(201).json({
      success: true,
      message: `Parent ${result.action} successfully`,
      data: result
    });

  } catch (error: any) {
    console.error('Error creating parent from CSV data:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * Get parent by email
 */
export const getParentByEmail = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const { data: parent, error } = await supabase
      .from('parents')
      .select(`
        *,
        parent_student_relationships!parent_student_relationships_parent_id_fkey(
          student:students(id, first_name, last_name, admission_no)
        )
      `)
      .eq('email', email)
      .single();

    if (error || !parent) {
      return res.status(404).json({
        success: false,
        error: 'Parent not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: parent
    });

  } catch (error: any) {
    console.error('Error fetching parent by email:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Bulk import parents from CSV file
 */
export const bulkImportParentsFromCSV = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No CSV file uploaded. Please upload a CSV file.'
      });
    }

    // Validate file type
    if (req.file.mimetype !== 'text/csv' && !req.file.originalname.endsWith('.csv')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Please upload a CSV file.'
      });
    }

    const csvData: ParentCSVData[] = [];
    const errors: Array<{ row: number; error: string; data?: any }> = [];
    const results: Array<{ success: boolean; data?: any; error?: string; row: number }> = [];

    // Parse CSV file
    await new Promise<void>((resolve, reject) => {
      const stream = Readable.from(req.file!.buffer);
      
      stream
        .pipe(csv({
          mapHeaders: ({ header }) => {
            // Map CSV headers to our expected format
            const headerMap: { [key: string]: string } = {
              'MIS ID': 'misId',
              'Forename': 'forename',
              'Legal Surname': 'legalSurname',
              'Primary Email': 'primaryEmail'
            };
            return headerMap[header] || header.toLowerCase().replace(/\s+/g, '');
          }
        }))
        .on('data', (row) => {
          csvData.push(row);
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    if (csvData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No data found in CSV file or file is empty.'
      });
    }

    console.log(`Processing ${csvData.length} parent records from CSV...`);

    // Process each parent record
    for (let i = 0; i < csvData.length; i++) {
      const parentData = csvData[i];
      const rowNumber = i + 2; // +2 because CSV starts from row 2 (row 1 is header)

      try {
        // Use the shared createParentFromData function
        const result = await createParentFromData(parentData);

        // Record successful result
        results.push({
          success: true,
          data: {
            ...result,
            misId: parentData.misId,
            name: `${parentData.forename} ${parentData.legalSurname}`
          },
          row: rowNumber
        });

      } catch (error: any) {
        console.error(`Error processing parent at row ${rowNumber}:`, error.message);
        
        // Record failed result
        results.push({
          success: false,
          error: error.message,
          row: rowNumber
        });

        errors.push({
          row: rowNumber,
          error: error.message,
          data: parentData
        });
      }
    }

    // Calculate summary statistics
    const successfulImports = results.filter(r => r.success).length;
    const failedImports = results.filter(r => !r.success).length;
    const totalProcessed = results.length;
    const linkedParents = results.filter(r => r.success && r.data?.linked).length;

    // Prepare response
    const response = {
      success: true,
      message: `${successfulImports} parents imported, ${failedImports} failed to import. ${linkedParents} parents linked to students.`,
      summary: {
        totalProcessed,
        successfulImports,
        failedImports,
        linkedParents,
        successRate: totalProcessed > 0 ? Math.round((successfulImports / totalProcessed) * 100) : 0
      },
      details: {
        successful: results.filter(r => r.success),
        failed: results.filter(r => !r.success)
      }
    };

    // Log summary
    console.log(`Bulk parent import completed: ${successfulImports} successful, ${failedImports} failed, ${linkedParents} linked out of ${totalProcessed} total`);

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('Error in bulk parent CSV import:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error during bulk import'
    });
  }
};
