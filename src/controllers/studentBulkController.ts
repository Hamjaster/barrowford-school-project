import { Response } from 'express';
import { supabase, supabaseAdmin } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import csv from 'csv-parser';
import { Readable } from 'stream';

interface StudentCSVData {
  misId: string;
  forename: string;
  legalSurname: string;
  reg: string;
  year: string;
  primaryEmail: string;
}

interface CreateStudentRequest {
  misId: string;
  forename: string;
  legalSurname: string;
  reg: string;
  year: string;
  primaryEmail: string;
}

/**
 * Extract first name from email address
 */
const extractFirstNameFromEmail = (email: string): string => {
  try {
    // Extract the part before @ and take the first part before any dots
    const localPart = email.split('@')[0];
    const firstName = localPart.split('.')[0];
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  } catch (error) {
    return 'Parent'; // Fallback name
  }
};

/**
 * Create or find parent by email
 */
const createOrFindParent = async (primaryEmail: string) => {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(primaryEmail)) {
      throw new Error(`Invalid email format: ${primaryEmail}`);
    }

    // Extract first name from email
    const firstName = extractFirstNameFromEmail(primaryEmail);
    
    // Check if parent already exists by primary email
    const { data: existingParent, error: existingError } = await supabase
      .from('parents')
      .select('id, first_name, last_name, email')
      .eq('email', primaryEmail)
      .single();

    console.log(existingParent, 'existingParent !!!', 'email : ', primaryEmail);

    let parentResult;
    let action = 'created';

    if (existingParent && !existingError) {
      // Parent exists, return existing parent
      console.log(`Found existing parent with primary email: ${primaryEmail}`);
      parentResult = existingParent;
      action = 'found';
    } else {
      // Parent doesn't exist, create new one
      console.log(`Creating new parent with primary email: ${primaryEmail}`);

      // Create Supabase Auth user (requires admin privileges)
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: primaryEmail,
        password: 'test1234',
        email_confirm: true,
        user_metadata: {
          first_name: firstName,
          last_name: null,
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
          first_name: firstName,
          last_name: null,
          email: primaryEmail,
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

    return {
      parent: parentResult,
      action: action
    };
  } catch (error: any) {
    throw new Error(`Parent operation failed: ${error.message}`);
  }
};

/**
 * Create student-parent relationship
 */
const createStudentParentRelationship = async (studentId: number, parentId: number) => {
  try {
    // Check if relationship already exists
    const { data: existingRelationship, error: relCheckError } = await supabase
      .from('parent_student_relationships')
      .select('id')
      .eq('parent_id', parentId)
      .eq('student_id', studentId)
      .single();

    if (existingRelationship && !relCheckError) {
      console.log(`Student-parent relationship already exists for parent ${parentId} and student ${studentId}`);
      return existingRelationship;
    }

    // Create parent-student relationship
    const { data: relationship, error: relError } = await supabase
      .from('parent_student_relationships')
      .insert({
        parent_id: parentId,
        student_id: studentId
      })
      .select('*')
      .single();

    if (relError) {
      throw new Error(`Failed to create parent-student relationship: ${relError.message}`);
    }

    console.log(`Created student-parent relationship for parent ${parentId} and student ${studentId}`);
    return relationship;
  } catch (error: any) {
    throw new Error(`Relationship creation failed: ${error.message}`);
  }
};

/**
 * Find or create year group by name
 */
const findOrCreateYearGroup = async (yearName: string) => {
  try {
    // First, try to find existing year group
    const { data: existingYearGroup, error: findError } = await supabase
      .from('year_groups')
      .select('id, name')
      .eq('name', yearName)
      .single();

    if (existingYearGroup && !findError) {
      return existingYearGroup;
    }

    // If not found, create new year group
    const { data: newYearGroup, error: createError } = await supabase
      .from('year_groups')
      .insert({
        name: yearName,
        description: `Year group for ${yearName}`
      })
      .select('id, name')
      .single();

    if (createError) {
      throw new Error(`Failed to create year group: ${createError.message}`);
    }

    return newYearGroup;
  } catch (error: any) {
    throw new Error(`Year group operation failed: ${error.message}`);
  }
};

/**
 * Find or create class by name
 */
const findOrCreateClass = async (className: string, yearGroupId: number) => {
  try {
    // First, try to find existing class
    const { data: existingClass, error: findError } = await supabase
      .from('classes')
      .select('id, name')
      .eq('name', className)
      .single();

    if (existingClass && !findError) {
      return existingClass;
    }

    // If not found, create new class
    const { data: newClass, error: createError } = await supabase
      .from('classes')
      .insert({
        name: className
      })
      .select('id, name')
      .single();

    if (createError) {
      throw new Error(`Failed to create class: ${createError.message}`);
    }

    return newClass;
  } catch (error: any) {
    throw new Error(`Class operation failed: ${error.message}`);
  }
};

/**
 * Create a single student from CSV data
 */
export const createStudentFromCSV = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      misId,
      forename,
      legalSurname,
      reg,
      year,
      primaryEmail
    }: CreateStudentRequest = req.body;

    // Validation
    if (!forename || !legalSurname || !misId || !year || !reg || !primaryEmail) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: misId, forename, legalSurname, reg, year, primaryEmail'
      });
    }

    // Trim spaces from email address
    const trimmedEmail = primaryEmail.trim();
    
    // Validate trimmed email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        error: `Invalid email format: ${trimmedEmail}`
      });
    }

    // Generate username and email for student
    const username = `${forename.toLowerCase()}.${legalSurname.toLowerCase()}`;
    const email = `${username}@school.com`;

    // Check if student already exists by admission_no (misId)
    const { data: existingStudent, error: existingError } = await supabase
      .from('students')
      .select('id, admission_no, first_name, last_name')
      .eq('admission_no', misId)
      .single();

    let studentResult;
    let action = 'created';

    if (existingStudent && !existingError) {
      // Student exists, update their details
      console.log(`Updating existing student with admission_no: ${misId}`);
      
      // Find or create year group
      const yearGroup = await findOrCreateYearGroup(year);
      
      // Find or create class
      const classData = await findOrCreateClass(reg, yearGroup.id);

      // Update student record
      const { data: updatedStudent, error: updateError } = await supabase
        .from('students')
        .update({
          first_name: forename,
          last_name: legalSurname,
          current_year_group_id: yearGroup.id,
          class_id: classData.id,
          username: username,
          email: email
        })
        .eq('admission_no', misId)
        .select('*')
        .single();

      if (updateError) {
        throw new Error(`Failed to update student: ${updateError.message}`);
      }

      studentResult = updatedStudent;
      action = 'updated';
    } else {
      // Student doesn't exist, create new one
      console.log(`Creating new student with admission_no: ${misId}`);

      // Find or create year group
      const yearGroup = await findOrCreateYearGroup(year);
      
      // Find or create class
      const classData = await findOrCreateClass(reg, yearGroup.id);

      // Create Supabase Auth user (requires admin privileges)
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: 'test1234',
        email_confirm: true,
        user_metadata: {
          first_name: forename,
          last_name: legalSurname,
          role: 'student'
        }
      });

      if (authError || !authUser.user) {
        throw new Error(`Failed to create auth user: ${authError?.message || 'Unknown error'}`);
      }

      // Create student record
      const { data: newStudent, error: studentError } = await supabase
        .from('students')
        .insert({
          auth_user_id: authUser.user.id,
          first_name: forename,
          last_name: legalSurname,
          admission_no: misId,
          current_year_group_id: yearGroup.id,
          enrolled_year_group_id: yearGroup.id,
          class_id: classData.id,
          username: username,
          email: email,
          status: 'active'
        })
        .select('*')
        .single();

      if (studentError) {
        // If student creation fails, clean up the auth user (requires admin privileges)
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        throw new Error(`Failed to create student record: ${studentError.message}`);
      }

      studentResult = newStudent;
    }

    // Create or find parent using trimmed primary email
    const parentResult = await createOrFindParent(trimmedEmail);

    // Create student-parent relationship
    const relationshipResult = await createStudentParentRelationship(studentResult.id, parentResult.parent.id);

    return res.status(201).json({
      success: true,
      message: `Student ${action} and parent linked successfully`,
      data: {
        student: studentResult,
        parent: parentResult.parent,
        relationship: relationshipResult,
        parentAction: parentResult.action,
        studentAction: action
      }
    });

  } catch (error: any) {
    console.error('Error creating student from CSV data:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

/**
 * Get student by admission number
 */
export const getStudentByAdmissionNo = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { admissionNo } = req.params;

    if (!admissionNo) {
      return res.status(400).json({
        success: false,
        error: 'Admission number is required'
      });
    }

    const { data: student, error } = await supabase
      .from('students')
      .select(`
        *,
        year_groups!students_current_year_group_id_fkey(name),
        classes!students_class_id_fkey(name)
      `)
      .eq('admission_no', admissionNo)
      .single();

    if (error || !student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: student
    });

  } catch (error: any) {
    console.error('Error fetching student by admission number:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Bulk import students from CSV file using the reusable createStudentFromCSV function
 * 
 * Expected CSV format (based on the provided CSV structure):
 * - MIS ID: Can be empty (will auto-generate if missing)
 * - Forename: Student's first name
 * - Legal Surname: Student's last name  
 * - Reg: Registration/Class info (e.g., "EYFS/Yr 1 O")
 * - Year: Year group (e.g., "Year R")
 * - Primary Email: Parent's email address (spaces will be automatically trimmed)
 * 
 * Example CSV content:
 * MIS ID,Forename,Legal Surname,Reg,Year,Primary Email
 * C02954,Harley,Ansbro,EYFS/Yr 1 O,Year R,lucy.belgrave@hotmail.com
 * C02955,Abdul-Momin,Arshad,EYFS/Yr 1 G,Year R,kaini_92gemini@hotmail.com
 * 
 * This function reuses the createStudentFromCSV logic to ensure consistency
 * and maintainability across single and bulk operations.
 */
export const bulkImportStudentsFromCSV = async (req: AuthenticatedRequest, res: Response) => {
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

    const csvData: StudentCSVData[] = [];
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
              'Reg': 'reg',
              'Year': 'year',
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

    console.log(`Processing ${csvData.length} student records from CSV...`);
    console.log('Sample CSV data:', csvData.slice(0, 2)); // Log first 2 rows for debugging

    // Process each student record using the reusable createStudentFromCSV function
    for (let i = 0; i < csvData.length; i++) {
      const studentData = csvData[i];
      const rowNumber = i + 2; // +2 because CSV starts from row 2 (row 1 is header)

      try {
        // Validate required fields (MIS ID can be empty based on the CSV format)
        if (!studentData.forename || !studentData.legalSurname || 
            !studentData.year || !studentData.reg || !studentData.primaryEmail) {
          throw new Error('Missing required fields: forename, legalSurname, year, reg, primaryEmail');
        }

        // Trim spaces from email address
        const originalEmail = studentData.primaryEmail;
        studentData.primaryEmail = studentData.primaryEmail.trim();
        
        // Log if email was trimmed (for debugging)
        if (originalEmail !== studentData.primaryEmail) {
          console.log(`Trimmed email for row ${rowNumber}: "${originalEmail}" -> "${studentData.primaryEmail}"`);
        }
        
        // Validate trimmed email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(studentData.primaryEmail)) {
          throw new Error(`Invalid email format: ${studentData.primaryEmail}`);
        }

        // Generate MIS ID if not provided (some rows in CSV have empty MIS ID)
        if (!studentData.misId || studentData.misId.trim() === '') {
          studentData.misId = `AUTO_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        // Create a mock request object for the createStudentFromCSV function
        const mockReq = {
          body: {
            misId: studentData.misId,
            forename: studentData.forename,
            legalSurname: studentData.legalSurname,
            reg: studentData.reg,
            year: studentData.year,
            primaryEmail: studentData.primaryEmail
          }
        } as AuthenticatedRequest;

        // Create a mock response object to capture the result
        let result: any = null;
        let error: any = null;

        const mockRes = {
          status: (code: number) => ({
            json: (data: any) => {
              if (code >= 200 && code < 300) {
                result = data;
              } else {
                error = data;
              }
            }
          })
        } as Response;

        // Call the reusable createStudentFromCSV function
        await createStudentFromCSV(mockReq, mockRes);

        if (error) {
          throw new Error(error.error || 'Failed to create student');
        }

        if (result && result.success) {
        // Record successful result
        results.push({
          success: true,
          data: {
              ...result.data,
            admission_no: studentData.misId,
            name: `${studentData.forename} ${studentData.legalSurname}`
          },
          row: rowNumber
        });
        } else {
          throw new Error('Unknown error occurred during student creation');
        }

      } catch (error: any) {
        console.error(`Error processing student at row ${rowNumber}:`, error.message);
        
        // Record failed result
        results.push({
          success: false,
          error: error.message,
          row: rowNumber
        });

        errors.push({
          row: rowNumber,
          error: error.message,
          data: studentData
        });
      }
    }

    // Calculate summary statistics
    const successfulImports = results.filter(r => r.success).length;
    const failedImports = results.filter(r => !r.success).length;
    const totalProcessed = results.length;
    const parentsCreated = results.filter(r => r.success && r.data?.parentAction === 'created').length;
    const parentsFound = results.filter(r => r.success && r.data?.parentAction === 'found').length;
    const relationshipsCreated = results.filter(r => r.success && r.data?.relationship).length;

    // Prepare response
    const response = {
      success: true,
      message: `${successfulImports} students imported, ${failedImports} failed to import. ${parentsCreated} parents created, ${parentsFound} existing parents linked.`,
      summary: {
        totalProcessed,
        successfulImports,
        failedImports,
        parentsCreated,
        parentsFound,
        relationshipsCreated,
        successRate: totalProcessed > 0 ? Math.round((successfulImports / totalProcessed) * 100) : 0
      },
      details: {
        successful: results.filter(r => r.success),
        failed: results.filter(r => !r.success)
      }
    };

    // Log summary
    console.log(`Bulk import completed: ${successfulImports} successful, ${failedImports} failed out of ${totalProcessed} total. ${parentsCreated} parents created, ${parentsFound} existing parents linked.`);

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('Error in bulk CSV import:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error during bulk import'
    });
  }
};
