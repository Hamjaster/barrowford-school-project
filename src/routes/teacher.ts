import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { getAssignedStudents } from '../controllers/teacherController.js';

const router = Router();

router.get(
  '/getStudents',
  authenticateToken,
  checkPermission('get_assigned_students'),
  getAssignedStudents as any
);

export default router;
