import { supabase } from '../db/supabase.js';
import { UploadSession, SessionLog } from '../types/uploadSession.js';

export class UploadSessionService {
  /**
   * Create a new upload session
   */
  async createSession(
    uploadId: string, 
    userId: number, 
    totalStudents: number
  ): Promise<UploadSession> {
    try {
      const { data: session, error } = await supabase
        .from('upload_sessions')
        .insert({
          upload_id: uploadId,
          user_id: userId,
          status: 'processing',
          total_students: totalStudents,
          processed_students: 0,
          success_count: 0,
          error_count: 0,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create upload session: ${error.message}`);
      }

      return session;
    } catch (error: any) {
      throw new Error(`Upload session creation failed: ${error.message}`);
    }
  }

  /**
   * Get session by upload ID
   */
  async getSession(uploadId: string): Promise<UploadSession | null> {
    try {
      const { data: session, error } = await supabase
        .from('upload_sessions')
        .select('*')
        .eq('upload_id', uploadId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to get session: ${error.message}`);
      }

      return session;
    } catch (error: any) {
      throw new Error(`Session retrieval failed: ${error.message}`);
    }
  }

  /**
   * Update session progress
   */
  async updateProgress(
    uploadId: string, 
    updates: Partial<UploadSession>
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('upload_sessions')
        .update(updates)
        .eq('upload_id', uploadId);

      if (error) {
        throw new Error(`Failed to update session progress: ${error.message}`);
      }
    } catch (error: any) {
      throw new Error(`Progress update failed: ${error.message}`);
    }
  }

  /**
   * Complete session
   */
  async completeSession(uploadId: string, finalStats?: any): Promise<void> {
    try {
      const { error } = await supabase
        .from('upload_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          ...finalStats
        })
        .eq('upload_id', uploadId);

      if (error) {
        throw new Error(`Failed to complete session: ${error.message}`);
      }
    } catch (error: any) {
      throw new Error(`Session completion failed: ${error.message}`);
    }
  }

  /**
   * Mark session as error
   */
  async markSessionError(uploadId: string, errorMessage?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('upload_sessions')
        .update({
          status: 'error',
          completed_at: new Date().toISOString()
        })
        .eq('upload_id', uploadId);

      if (error) {
        throw new Error(`Failed to mark session as error: ${error.message}`);
      }
    } catch (error: any) {
      throw new Error(`Session error marking failed: ${error.message}`);
    }
  }

  /**
   * Add session log for a student
   */
  async addSessionLog(logData: Omit<SessionLog, 'id' | 'created_at'>): Promise<SessionLog> {
    try {
      const { data: log, error } = await supabase
        .from('session_logs')
        .insert({
          ...logData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to add session log: ${error.message}`);
      }

      return log;
    } catch (error: any) {
      throw new Error(`Session log creation failed: ${error.message}`);
    }
  }

  /**
   * Get recent session logs
   */
  async getRecentLogs(uploadId: string, limit: number = 5): Promise<SessionLog[]> {
    try {
      const { data: logs, error } = await supabase
        .from('session_logs')
        .select('*')
        .eq('upload_id', uploadId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Failed to get recent logs: ${error.message}`);
      }

      return logs || [];
    } catch (error: any) {
      throw new Error(`Recent logs retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get all session logs for an upload
   */
  async getAllLogs(uploadId: string): Promise<SessionLog[]> {
    try {
      const { data: logs, error } = await supabase
        .from('session_logs')
        .select('*')
        .eq('upload_id', uploadId)
        .order('student_row_number', { ascending: true });

      if (error) {
        throw new Error(`Failed to get all logs: ${error.message}`);
      }

      return logs || [];
    } catch (error: any) {
      throw new Error(`All logs retrieval failed: ${error.message}`);
    }
  }

  /**
   * Clean up old sessions (older than 24 hours)
   */
  async cleanupOldSessions(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - 24);

      const { error } = await supabase
        .from('upload_sessions')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) {
        throw new Error(`Failed to cleanup old sessions: ${error.message}`);
      }
    } catch (error: any) {
      throw new Error(`Session cleanup failed: ${error.message}`);
    }
  }
}

export const uploadSessionService = new UploadSessionService();
