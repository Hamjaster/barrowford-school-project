import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import {
  createSubject,
  updateSubject,
  deleteSubject,
  getAllSubjects,
  toggleSubjectStatus,
  getAllyear_groups,
  getAllClasses,
  getSubjectsByYearGroup,
  getEligibleYearGroupsForStudent
} from '../controllers/subjectController.js';

const router = Router();

// Only admin, staff_admin, staff can manage subjects
router.post('/', authenticateToken, checkPermission('manage_users'), createSubject as any);
router.put('/:id', authenticateToken, checkPermission('manage_users'), updateSubject as any);
router.delete('/:id', authenticateToken, checkPermission('manage_users'), deleteSubject as any);
router.get('/', getAllSubjects);
router.patch('/status/:id', authenticateToken, checkPermission('manage_users'), toggleSubjectStatus as any);

// Year groups and subjects by year group routes
router.get('/year-groups', getAllyear_groups);
router.get('/classes', getAllClasses);
router.get('/year-groups/:yearGroupId/subjects', getSubjectsByYearGroup);
router.get('/eligible-year-groups', authenticateToken, getEligibleYearGroupsForStudent as any);

export default router;
