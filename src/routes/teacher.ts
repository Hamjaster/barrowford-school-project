import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { getAssignedStudents,getTeacherProfile } from '../controllers/teacherController.js';

const router = Router();

router.get(
  '/getStudents',
  authenticateToken,
  checkPermission('get_assigned_students'),
  getAssignedStudents as any
);

router.get(
  '/teacher-profile',
  authenticateToken,
  checkPermission('view_teacher_profile'),
  getTeacherProfile as any
);

export default router;
