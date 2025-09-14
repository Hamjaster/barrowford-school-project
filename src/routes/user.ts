import { Router, Request, Response } from 'express';
// import { db } from '../db';

import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { getAllUsers, toggleUserStatus } from '../controllers/userControllers.js';

const router = Router();

// User management routes
router.get('/', authenticateToken, checkPermission('get_users'), getAllUsers as any);
router.post('/status', authenticateToken, checkPermission('manage_users'), toggleUserStatus as any);

export default router;
