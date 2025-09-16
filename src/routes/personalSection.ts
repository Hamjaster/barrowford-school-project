import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import {
  createPersonalSectionTopic,
  updatePersonalSectionTopic,
  deletePersonalSectionTopic,
  getAllPersonalSectionTopics,
  togglePersonalSectionTopicStatus,
} from '../controllers/personalSectionController.js';
import { createPersonalSection, getMyPersonalSections, updatePersonalSection } from '../controllers/personalSectionController.js';

const router = Router();

// Only admin, staff_admin, staff can manage topics
router.post('/topics', authenticateToken, checkPermission('manage_users'), createPersonalSectionTopic as any);
router.put('/topics/:id', authenticateToken, checkPermission('manage_users'), updatePersonalSectionTopic as any);
router.delete('/topics/:id', authenticateToken, checkPermission('manage_users'), deletePersonalSectionTopic as any);
router.patch('/topics/status/:id', authenticateToken, checkPermission('manage_users'), togglePersonalSectionTopicStatus as any);

// Intended for students
router.get('/topics', authenticateToken, getAllPersonalSectionTopics as any);
router.post('/', authenticateToken,checkPermission('manage_personal_section'), createPersonalSection as any);
router.put('/:id', authenticateToken,checkPermission('manage_personal_section'), updatePersonalSection as any);
router.get('/me', authenticateToken,checkPermission('manage_personal_section'), getMyPersonalSections as any);


export default router;
