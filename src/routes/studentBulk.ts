import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { createStudentFromCSV, getStudentByAdmissionNo, bulkImportStudentsFromCSV } from '../controllers/studentBulkController.js';
import { csvUpload } from '../middleware/multer.js';

const router = Router();

// Create a single student from CSV data
router.post('/create-student', createStudentFromCSV as any);

// Bulk import students from CSV file
// router.post('/bulk-import', authenticateToken, checkPermission('manage_students'), csvUpload.single('csvFile'), bulkImportStudentsFromCSV as any);
router.post('/bulk-import', csvUpload.single('csvFile'), bulkImportStudentsFromCSV as any);

// Get student by admission number
router.get('/admission/:admissionNo', authenticateToken, checkPermission('fetch-users'), getStudentByAdmissionNo as any);

export default router;
