import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { uploadSessionService } from '../services/uploadSessionService.js';
import { createStudentFromCSV } from './studentBulkController.js';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';

interface StudentCSVData {
  misId: string;
  forename: string;
  legalSurname: string;
  reg: string;
  year: string;
  primaryEmail: string;
}

/**
 * Upload CSV and create session for SSE processing
 * POST /api/student-bulk/upload
 */
export const uploadCSVWithSSE = async (req: AuthenticatedRequest, res: Response) => {
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

    // Parse CSV data
    const csvData: StudentCSVData[] = [];
    
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
          if (Object.values(row).some((v) => v && v.toString().trim() !== '')) {
            csvData.push(row);
          }
        
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

    // Generate unique upload ID
    const uploadId = uuidv4();
    
    // Create upload session
    const session = await uploadSessionService.createSession(
      uploadId,
      parseInt(req.user.userId),
      csvData.length
    );
    console.log('Starting background processing with csv DATA :', csvData);

    // Start background processing (don't await)
    processStudentsInBackground(uploadId, csvData, session.id);


    return res.status(200).json({
      success: true,
      message: 'Upload started successfully. Connect to SSE stream for progress updates.',
      data: {
        uploadId,
        totalStudents: csvData.length,
        sessionId: session.id,
        sseEndpoint: `/api/student-bulk/stream/${uploadId}`,
        statusEndpoint: `/api/student-bulk/session/${uploadId}`
      }
    });

  } catch (error: any) {
    console.error('CSV upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error during upload'
    });
  }
};

/**
 * Process students in background (one by one)
 */
async function processStudentsInBackground(
  uploadId: string, 
  csvData: StudentCSVData[], 
  sessionId: string
) {
  console.log(`Starting background processing for uploadId: ${uploadId}`);
  
  try {
    for (let i = 0; i < csvData.length; i++) {
      const studentData = csvData[i];
      const rowNumber = i + 1; // 1-based row number
      const startTime = Date.now();
      
      try {
        console.log(`Processing student ${rowNumber}/${csvData.length}: ${studentData.forename} ${studentData.legalSurname}`);
        
        // Process single student using existing logic
        const result = await processSingleStudent(studentData);
        
        // Log success
        await uploadSessionService.addSessionLog({
          session_id: sessionId,
          upload_id: uploadId,
          student_row_number: rowNumber,
          student_name: `${studentData.forename} ${studentData.legalSurname}`,
          student_mis_id: studentData.misId,
          status: 'success',
          success_message: `Student ${result.studentAction} and parent ${result.parentAction} successfully`,
          student_id: result.student.id,
          parent_id: result.parent.id,
          processing_time_ms: Date.now() - startTime
        });
        
        // Update session progress
        await uploadSessionService.updateProgress(uploadId, {
          processed_students: i + 1,
          success_count: (await getCurrentSuccessCount(uploadId)) + 1
        });
        
        console.log(`✅ Student ${rowNumber} processed successfully`);
        
      } catch (error: any) {
        console.error(`❌ Error processing student ${rowNumber}:`, error.message);
        
        // Log error
        await uploadSessionService.addSessionLog({
          session_id: sessionId,
          upload_id: uploadId,
          student_row_number: rowNumber,
          student_name: `${studentData.forename} ${studentData.legalSurname}`,
          student_mis_id: studentData.misId,
          status: 'error',
          error_message: error.message,
          processing_time_ms: Date.now() - startTime
        });
        
        // Update session progress
        await uploadSessionService.updateProgress(uploadId, {
          processed_students: i + 1,
          error_count: (await getCurrentErrorCount(uploadId)) + 1
        });
      }
      
      // Small delay to prevent overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Mark session as completed
    await uploadSessionService.completeSession(uploadId);
    console.log(`🎉 Background processing completed for uploadId: ${uploadId}`);
    
  } catch (error: any) {
    console.error(`💥 Critical error in background processing for uploadId: ${uploadId}`, error);
    await uploadSessionService.markSessionError(uploadId, error.message);
  }
}

/**
 * Process a single student (reuse existing logic)
 */
async function processSingleStudent(studentData: StudentCSVData) {
  // Create a mock request object for the existing createStudentFromCSV function
  const mockReq = {
    body: {
      misId: studentData.misId,
      forename: studentData.forename,
      legalSurname: studentData.legalSurname,
      reg: studentData.reg,
      year: studentData.year,
      primaryEmail: studentData.primaryEmail.trim()
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

  // Call the existing createStudentFromCSV function
  await createStudentFromCSV(mockReq, mockRes);

  if (error) {
    throw new Error(error.error || 'Failed to create student');
  }

  if (!result || !result.success) {
    throw new Error('Unknown error occurred during student creation');
  }

  return result.data;
}

/**
 * Get current success count for session
 */
async function getCurrentSuccessCount(uploadId: string): Promise<number> {
  try {
    const session = await uploadSessionService.getSession(uploadId);
    return session?.success_count || 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Get current error count for session
 */
async function getCurrentErrorCount(uploadId: string): Promise<number> {
  try {
    const session = await uploadSessionService.getSession(uploadId);
    return session?.error_count || 0;
  } catch (error) {
    return 0;
  }
}
