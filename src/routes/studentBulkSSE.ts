import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { uploadCSVWithSSE } from '../controllers/studentBulkSSEController.js';
import { streamUploadProgress, getSessionDetails, getUserSessions } from '../controllers/sseController.js';
import { csvUpload } from '../middleware/multer.js';

const router = Router();

// Upload CSV and create session for SSE processing
router.post('/upload', authenticateToken, checkPermission('manage_students'), csvUpload.single('csvFile'), uploadCSVWithSSE as any);

// Stream upload progress via Server-Sent Events
router.get('/stream/:uploadId', streamUploadProgress as any);

// Get session details and logs
router.get('/session/:uploadId', authenticateToken, getSessionDetails as any);

// Get all sessions for a user
router.get('/sessions', authenticateToken, getUserSessions as any);

export default router;
