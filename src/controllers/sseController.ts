import { Request, Response } from 'express';
import { uploadSessionService } from '../services/uploadSessionService.js';
import { SSEEvent } from '../types/uploadSession.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { supabase } from '../db/supabase.js';

/**
 * Stream upload progress via Server-Sent Events
 * GET /api/student-bulk/stream/:uploadId
 */
export const streamUploadProgress = async (req: Request, res: Response) => {
  const { uploadId } = req.params;

  if (!uploadId) {
    return res.status(400).json({
      success: false,
      error: 'Upload ID is required'
    });
  }

  try {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial connection event
    const initialEvent: SSEEvent = {
      type: 'started',
      data: {
        uploadId,
        status: 'connecting',
        totalStudents: 0,
        processedStudents: 0,
        successCount: 0,
        errorCount: 0,
        percentage: 0
      }
    };

    res.write(`data: ${JSON.stringify(initialEvent)}\n\n`);

    // Polling interval for database updates
    const pollInterval = setInterval(async () => {
      try {
        // Get session progress
        const session = await uploadSessionService.getSession(uploadId);
        
        if (!session) {
          const errorEvent: SSEEvent = {
            type: 'error',
            data: {
              uploadId,
              status: 'not_found',
              totalStudents: 0,
              processedStudents: 0,
              successCount: 0,
              errorCount: 0,
              percentage: 0
            }
          };
          
          res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
          clearInterval(pollInterval);
          res.end();
          return;
        }

        // Get recent student logs (last 5)
        const recentLogs = await uploadSessionService.getRecentLogs(uploadId, 5);

        // Calculate percentage
        const percentage = session.total_students > 0 
          ? Math.round((session.processed_students / session.total_students) * 100)
          : 0;

        // Create progress event
        const progressEvent: SSEEvent = {
          type: 'progress',
          data: {
            uploadId: session.upload_id,
            status: session.status,
            totalStudents: session.total_students,
            processedStudents: session.processed_students,
            successCount: session.success_count,
            errorCount: session.error_count,
            percentage,
            recentStudents: recentLogs.map(log => ({
              rowNumber: log.student_row_number,
              studentName: log.student_name,
              status: log.status,
              message: log.status === 'success' ? log.success_message || 'Success' : log.error_message || 'Error',
              processingTime: log.processing_time_ms
            }))
          }
        };

        res.write(`data: ${JSON.stringify(progressEvent)}\n\n`);

        // Close connection if session is completed or errored
        if (session.status === 'completed' || session.status === 'error') {
          const finalEvent: SSEEvent = {
            type: session.status === 'completed' ? 'completed' : 'error',
            data: {
              uploadId: session.upload_id,
              status: session.status,
              totalStudents: session.total_students,
              processedStudents: session.processed_students,
              successCount: session.success_count,
              errorCount: session.error_count,
              percentage: session.status === 'completed' ? 100 : percentage
            }
          };

          res.write(`data: ${JSON.stringify(finalEvent)}\n\n`);
          clearInterval(pollInterval);
          res.end();
        }

      } catch (error: any) {
        console.error('SSE polling error:', error);
        
        const errorEvent: SSEEvent = {
          type: 'error',
          data: {
            uploadId,
            status: 'polling_error',
            totalStudents: 0,
            processedStudents: 0,
            successCount: 0,
            errorCount: 0,
            percentage: 0
          }
        };

        res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
        clearInterval(pollInterval);
        res.end();
      }
    }, 1000); // Poll every 1 second

    // Clean up on client disconnect
    req.on('close', () => {
      console.log(`SSE connection closed for uploadId: ${uploadId}`);
      clearInterval(pollInterval);
    });

    req.on('error', (error) => {
      console.error(`SSE connection error for uploadId: ${uploadId}`, error);
      clearInterval(pollInterval);
    });

  } catch (error: any) {
    console.error('SSE stream setup error:', error);
    
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to setup SSE stream'
      });
    }
  }
};

/**
 * Get session details
 * GET /api/student-bulk/session/:uploadId
 */
export const getSessionDetails = async (req: Request, res: Response) => {
  const { uploadId } = req.params;

  if (!uploadId) {
    return res.status(400).json({
      success: false,
      error: 'Upload ID is required'
    });
  }

  try {
    // Get session details
    const session = await uploadSessionService.getSession(uploadId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Get all session logs
    const logs = await uploadSessionService.getAllLogs(uploadId);

    return res.status(200).json({
      success: true,
      data: {
        session: {
          id: session.id,
          upload_id: session.upload_id,
          status: session.status,
          total_students: session.total_students,
          processed_students: session.processed_students,
          success_count: session.success_count,
          error_count: session.error_count,
          started_at: session.started_at,
          completed_at: session.completed_at
        },
        logs: logs.map(log => ({
          id: log.id,
          student_row_number: log.student_row_number,
          student_name: log.student_name,
          student_mis_id: log.student_mis_id,
          status: log.status,
          message: log.status === 'success' ? log.success_message : log.error_message,
          student_id: log.student_id,
          parent_id: log.parent_id,
          processing_time_ms: log.processing_time_ms,
          created_at: log.created_at
        }))
      }
    });

  } catch (error: any) {
    console.error('Get session details error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get session details'
    });
  }
};

/**
 * Get all sessions for a user
 * GET /api/student-bulk-sse/sessions
 */
export const getUserSessions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = parseInt(req.user.userId);
    const { page = 1, limit = 10, status } = req.query;
    
    // Calculate offset for pagination
    const offset = (Number(page) - 1) * Number(limit);
    
    // Build query
    let query = supabase
      .from('upload_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    // Add pagination
    query = query.range(offset, offset + Number(limit) - 1);
    
    const { data: sessions, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get user sessions: ${error.message}`);
    }
    
    // Get total count for pagination
    let countQuery = supabase
      .from('upload_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    if (status && status !== 'all') {
      countQuery = countQuery.eq('status', status);
    }
    
    const { count, error: countError } = await countQuery;
    
    if (countError) {
      throw new Error(`Failed to get session count: ${countError.message}`);
    }
    
    // Calculate pagination info
    const totalPages = Math.ceil((count || 0) / Number(limit));
    const hasNextPage = Number(page) < totalPages;
    const hasPrevPage = Number(page) > 1;
    
    return res.status(200).json({
      success: true,
      data: {
        sessions: sessions?.map(session => ({
          id: session.id,
          upload_id: session.upload_id,
          status: session.status,
          total_students: session.total_students,
          processed_students: session.processed_students,
          success_count: session.success_count,
          error_count: session.error_count,
          started_at: session.started_at,
          completed_at: session.completed_at,
          created_at: session.created_at
        })) || [],
        pagination: {
          currentPage: Number(page),
          totalPages,
          totalSessions: count || 0,
          hasNextPage,
          hasPrevPage,
          limit: Number(limit)
        }
      }
    });

  } catch (error: any) {
    console.error('Get user sessions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user sessions'
    });
  }
};
