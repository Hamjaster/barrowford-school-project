import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import {
  createPersonalSectionTopic,
  updatePersonalSectionTopic,
  deletePersonalSectionTopic,
  getAllPersonalSectionTopics,
  getAllPersonalSectionTopicsForManagement,
  togglePersonalSectionTopicStatus,
  getMyPersonalSectionByTopic,
  getStudentPersonalSections,
  updatePersonalSectionByTeacher,
} from '../controllers/personalSectionController.js';
import { createPersonalSection, getMyPersonalSections, updatePersonalSection } from '../controllers/personalSectionController.js';

const router = Router();

// Only admin, staff_admin, staff can manage topics
router.post('/topics', authenticateToken, checkPermission('manage_users'), createPersonalSectionTopic as any);
router.put('/topics/:id', authenticateToken, checkPermission('manage_users'), updatePersonalSectionTopic as any);
router.delete('/topics/:id', authenticateToken, checkPermission('manage_users'), deletePersonalSectionTopic as any);
router.patch('/topics/status/:id', authenticateToken, checkPermission('manage_users'), togglePersonalSectionTopicStatus as any);
router.get('/topics/all', authenticateToken, checkPermission('manage_users'), getAllPersonalSectionTopicsForManagement as any);

// Intended for students
router.get('/topics', authenticateToken, getAllPersonalSectionTopics as any);
router.post('/', authenticateToken,checkPermission('manage_personal_section'), createPersonalSection as any);
router.put('/:id', authenticateToken,checkPermission('manage_personal_section'), updatePersonalSection as any);
router.get('/me', authenticateToken,checkPermission('manage_personal_section'), getMyPersonalSections as any);
router.get('/me/:topicId', authenticateToken,checkPermission('manage_personal_section'), getMyPersonalSectionByTopic as any);

// Teacher routes for managing student personal sections
router.get('/student/:studentId', authenticateToken, checkPermission('get_assigned_students'), getStudentPersonalSections as any);
router.put('/teacher/:id', authenticateToken, checkPermission('get_assigned_students'), updatePersonalSectionByTeacher as any);


export default router;
