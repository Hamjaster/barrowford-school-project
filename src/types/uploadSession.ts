export interface UploadSession {
  id: string;
  upload_id: string;
  user_id: string;
  status: 'processing' | 'completed' | 'error';
  total_students: number;
  processed_students: number;
  success_count: number;
  error_count: number;
  started_at: Date;
  completed_at?: Date;
  created_at: Date;
}

export interface SessionLog {
  id: string;
  session_id: string;
  upload_id: string;
  student_row_number: number;
  student_name: string;
  student_mis_id: string;
  status: 'success' | 'error' | 'skipped';
  success_message?: string;
  error_message?: string;
  student_id?: number;
  parent_id?: number;
  processing_time_ms: number;
  created_at: Date;
}

export interface SSEEvent {
  type: 'progress' | 'started' | 'completed' | 'error';
  data: {
    uploadId: string;
    status: string;
    totalStudents: number;
    processedStudents: number;
    successCount: number;
    errorCount: number;
    percentage: number;
    recentStudents?: Array<{
      rowNumber: number;
      studentName: string;
      status: string;
      message: string;
      processingTime: number;
    }>;
  };
}
