import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import {
  createPersonalSectionTopic,
  updatePersonalSectionTopic,
  deletePersonalSectionTopic,
  getAllpersonal_section_topics,
  getAllpersonal_section_topicsForManagement,
  togglepersonal_section_topicstatus,
  getMyPersonalSectionByTopic,
  getStudentpersonal_sections,
  updatePersonalSectionByTeacher,
} from '../controllers/personalSectionController.js';
import { createPersonalSection, getMypersonal_sections, updatePersonalSection } from '../controllers/personalSectionController.js';

const router = Router();

// Only admin, staff_admin, staff can manage topics
router.post('/topics', authenticateToken, checkPermission('manage_users'), createPersonalSectionTopic as any);
router.put('/topics/:id', authenticateToken, checkPermission('manage_users'), updatePersonalSectionTopic as any);
router.delete('/topics/:id', authenticateToken, checkPermission('manage_users'), deletePersonalSectionTopic as any);
router.patch('/topics/status/:id', authenticateToken, checkPermission('manage_users'), togglepersonal_section_topicstatus as any);
router.get('/topics/all', authenticateToken, checkPermission('manage_users'), getAllpersonal_section_topicsForManagement as any);

// Intended for students
router.get('/topics', authenticateToken, getAllpersonal_section_topics as any);
router.post('/', authenticateToken,checkPermission('manage_personal_section'), createPersonalSection as any);
router.put('/:id', authenticateToken,checkPermission('manage_personal_section'), updatePersonalSection as any);
router.get('/me', authenticateToken,checkPermission('manage_personal_section'), getMypersonal_sections as any);
router.get('/me/:topicId', authenticateToken,checkPermission('manage_personal_section'), getMyPersonalSectionByTopic as any);

// Teacher routes for managing student personal sections
router.get('/student/:studentId', authenticateToken, checkPermission('get_assigned_students'), getStudentpersonal_sections as any);
router.put('/teacher/:id', authenticateToken, checkPermission('get_assigned_students'), updatePersonalSectionByTeacher as any);


export default router;
