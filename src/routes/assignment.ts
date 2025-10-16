import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  getStudentAssignments,
  assignParentsToStudent,
  assignTeacherToStudent,
  removeTeacherFromStudent
} from '../controllers/assignmentController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get student assignment details (parents and teacher)
router.get('/student/:studentId', getStudentAssignments as any);

// Assign parents to student
router.post('/student/:studentId/parents', assignParentsToStudent as any);

// Assign teacher to student
router.post('/student/:studentId/teacher', assignTeacherToStudent as any);

// Remove teacher assignment from student
router.delete('/student/:studentId/teacher', removeTeacherFromStudent as any);

export default router;
