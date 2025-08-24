import { Router, Request, Response } from 'express';
// import { db } from '../db';

import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { getAllUsers } from '../controllers/authControllers.js';

const router = Router();

// User management routes
router.get('/', authenticateToken, checkPermission('manage_users'), getAllUsers as any);

export default router;
