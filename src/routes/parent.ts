import { Router } from 'express';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { getMyChildren, getChildDetails } from '../controllers/parentController.js';

const router = Router();

// Fetch all children of a parent
router.get('/children', authenticateToken, checkPermission("view_children"), getMyChildren as any);

// Get details of one specific child (learnings, images, reflections)
router.get('/children/:studentId', authenticateToken, checkPermission("view_children"), getChildDetails as any);

export default router;
