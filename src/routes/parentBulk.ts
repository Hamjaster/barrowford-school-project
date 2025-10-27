import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { createParentFromCSV, getParentByEmail, bulkImportParentsFromCSV } from '../controllers/parentBulkController.js';
import { csvUpload } from '../middleware/multer.js';

const router = Router();

// Create a single parent from CSV data
router.post('/single', createParentFromCSV as any);

// Get parent by email
router.get('/email/:email', authenticateToken, checkPermission("manage_users"), getParentByEmail as any);

// Bulk import parents from CSV file
router.post('/bulk', csvUpload.single('csvFile'), bulkImportParentsFromCSV as any);

export default router;
