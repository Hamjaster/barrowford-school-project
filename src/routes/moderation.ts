import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import {
  listPendingModerations,
  approveModeration,
  rejectModeration,
  getModerationById
} from '../controllers/moderationController.js';

const router = Router();

// Teachers (and admins/staff_admin) should have permission 'moderate_content'
router.get('/', authenticateToken, checkPermission('moderate_content'), listPendingModerations as any);
router.get('/:id', authenticateToken, checkPermission('moderate_content'), getModerationById as any);
router.post('/:id/approve', authenticateToken, checkPermission('moderate_content'), approveModeration as any);
router.post('/:id/reject', authenticateToken, checkPermission('moderate_content'), rejectModeration as any);

export default router;
