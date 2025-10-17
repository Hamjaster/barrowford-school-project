import { Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import csv from 'csv-parser';
import { Readable } from 'stream';

interface StudentCSVData {
  forename: string;
  legalSurname: string;
  gender: string;
  dob: string;
  adno: string;
  year: string;
  reg: string;
}

interface CreateStudentRequest {
  forename: string;
  legalSurname: string;
  gender: string;
  dob: string;
  adno: string;
  year: string;
  reg: string;
}

/**
 * Parse date from "DD Month YYYY" format to ISO date string
 */
const parseDate = (dateStr: string): string => {
  try {
    // Handle formats like "08 October 2014", "27 December 2018"
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }
    return date.toISOString();
  } catch (error) {
    throw new Error(`Failed to parse date: ${dateStr}`);
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
        name: className,
        year_group_id: yearGroupId
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
      forename,
      legalSurname,
      gender,
      dob,
      adno,
      year,
      reg
    }: CreateStudentRequest = req.body;

    // Validation
    if (!forename || !legalSurname || !gender || !dob || !adno || !year || !reg) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required: forename, legalSurname, gender, dob, adno, year, reg'
      });
    }

    // Validate gender
    if (!['M', 'F'].includes(gender.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: 'Gender must be M or F'
      });
    }

    // Parse date
    let parsedDob: string;
    try {
      parsedDob = parseDate(dob);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    // Generate username and email
    const username = `${forename.toLowerCase()}.${legalSurname.toLowerCase()}`;
    const email = `${username}@school.com`;

    // Check if student already exists by admission_no
    const { data: existingStudent, error: existingError } = await supabase
      .from('students')
      .select('id, admission_no, first_name, last_name')
      .eq('admission_no', adno)
      .single();

    if (existingStudent && !existingError) {
      // Student exists, update their details
      console.log(`Updating existing student with admission_no: ${adno}`);
      
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
          gender: gender.toUpperCase(),
          dob: parsedDob,
          year_group_id: yearGroup.id,
          current_year_group_id: yearGroup.id, // Same as year_group_id as requested
          class_id: classData.id,
          username: username,
          email: email
        })
        .eq('admission_no', adno)
        .select('*')
        .single();

      if (updateError) {
        throw new Error(`Failed to update student: ${updateError.message}`);
      }

      return res.status(200).json({
        success: true,
        message: 'Student updated successfully',
        data: {
          student: updatedStudent,
          yearGroup,
          class: classData,
          action: 'updated'
        }
      });
    }

    // Student doesn't exist, create new one
    console.log(`Creating new student with admission_no: ${adno}`);

    // Find or create year group
    const yearGroup = await findOrCreateYearGroup(year);
    
    // Find or create class
    const classData = await findOrCreateClass(reg, yearGroup.id);

    // Create Supabase Auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
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
        gender: gender.toUpperCase(),
        dob: parsedDob,
        admission_no: adno,
        year_group_id: yearGroup.id,
        current_year_group_id: yearGroup.id, // Same as year_group_id as requested
        enrolled_year_group_id: yearGroup.id, // Same as year_group_id as requested
        class_id: classData.id,
        username: username,
        email: email,
        status: 'active'
      })
      .select('*')
      .single();

    if (studentError) {
      // If student creation fails, clean up the auth user
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw new Error(`Failed to create student record: ${studentError.message}`);
    }

    return res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: {
        student: newStudent,
        yearGroup,
        class: classData,
        authUser: {
          id: authUser.user.id,
          email: authUser.user.email
        },
        action: 'created'
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
        year_groups!students_year_group_id_fkey(name),
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
 * Bulk import students from CSV file
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
              'Forename': 'forename',
              'Legal Surname': 'legalSurname',
              'Gender': 'gender',
              'DOB': 'dob',
              'Adno': 'adno',
              'Year': 'year',
              'Reg': 'reg'
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

    // Process each student record
    for (let i = 0; i < csvData.length; i++) {
      const studentData = csvData[i];
      const rowNumber = i + 2; // +2 because CSV starts from row 2 (row 1 is header)

      try {
        // Validate required fields
        if (!studentData.forename || !studentData.legalSurname || !studentData.gender || 
            !studentData.dob || !studentData.adno || !studentData.year || !studentData.reg) {
          throw new Error('Missing required fields: forename, legalSurname, gender, dob, adno, year, reg');
        }

        // Validate gender
        if (!['M', 'F'].includes(studentData.gender.toUpperCase())) {
          throw new Error('Gender must be M or F');
        }

        // Parse date
        let parsedDob: string;
        try {
          parsedDob = parseDate(studentData.dob);
        } catch (error) {
          throw new Error(`Invalid date format: ${studentData.dob}`);
        }

        // Generate username and email
        const username = `${studentData.forename.toLowerCase()}.${studentData.legalSurname.toLowerCase()}`;
        const email = `${username}@school.com`;

        // Check if student already exists by admission_no
        const { data: existingStudent, error: existingError } = await supabase
          .from('students')
          .select('id, admission_no, first_name, last_name')
          .eq('admission_no', studentData.adno)
          .single();

        let action = 'created';
        let studentResult;

        if (existingStudent && !existingError) {
          // Student exists, update their details
          console.log(`Updating existing student with admission_no: ${studentData.adno} (Row ${rowNumber})`);
          
          // Find or create year group
          const yearGroup = await findOrCreateYearGroup(studentData.year);
          
          // Find or create class
          const classData = await findOrCreateClass(studentData.reg, yearGroup.id);

          // Update student record
          const { data: updatedStudent, error: updateError } = await supabase
            .from('students')
            .update({
              first_name: studentData.forename,
              last_name: studentData.legalSurname,
              gender: studentData.gender.toUpperCase(),
              dob: parsedDob,
              year_group_id: yearGroup.id,
              current_year_group_id: yearGroup.id,
              class_id: classData.id,
              username: username,
              email: email
            })
            .eq('admission_no', studentData.adno)
            .select('*')
            .single();

          if (updateError) {
            throw new Error(`Failed to update student: ${updateError.message}`);
          }

          studentResult = updatedStudent;
          action = 'updated';
        } else {
          // Student doesn't exist, create new one
          console.log(`Creating new student with admission_no: ${studentData.adno} (Row ${rowNumber})`);

          // Find or create year group
          const yearGroup = await findOrCreateYearGroup(studentData.year);
          
          // Find or create class
          const classData = await findOrCreateClass(studentData.reg, yearGroup.id);

          // Create Supabase Auth user
          const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: 'test1234',
            email_confirm: true,
            user_metadata: {
              first_name: studentData.forename,
              last_name: studentData.legalSurname,
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
              first_name: studentData.forename,
              last_name: studentData.legalSurname,
              gender: studentData.gender.toUpperCase(),
              dob: parsedDob,
              admission_no: studentData.adno,
              year_group_id: yearGroup.id,
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
            // If student creation fails, clean up the auth user
            await supabase.auth.admin.deleteUser(authUser.user.id);
            throw new Error(`Failed to create student record: ${studentError.message}`);
          }

          studentResult = newStudent;
        }

        // Record successful result
        results.push({
          success: true,
          data: {
            student: studentResult,
            action: action,
            admission_no: studentData.adno,
            name: `${studentData.forename} ${studentData.legalSurname}`
          },
          row: rowNumber
        });

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

    // Prepare response
    const response = {
      success: true,
      message: `${successfulImports} students imported, ${failedImports} failed to import`,
      summary: {
        totalProcessed,
        successfulImports,
        failedImports,
        successRate: totalProcessed > 0 ? Math.round((successfulImports / totalProcessed) * 100) : 0
      },
      details: {
        successful: results.filter(r => r.success),
        failed: results.filter(r => !r.success)
      }
    };

    // Log summary
    console.log(`Bulk import completed: ${successfulImports} successful, ${failedImports} failed out of ${totalProcessed} total`);

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('Error in bulk CSV import:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error during bulk import'
    });
  }
};
