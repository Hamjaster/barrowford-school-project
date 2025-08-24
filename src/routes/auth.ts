import { Router, Request, Response } from 'express';
// import { db } from '../db';
import { AuthUtils } from '../utils/auth.js';
import { EmailService } from '../utils/email.js';
import { 
  validate, 
  loginSchema, 
  passwordResetRequestSchema, 
  passwordResetSchema,
  changePasswordSchema 
} from '../middleware/validation.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateToken, checkPermission } from '../middleware/auth.js';
import { config } from '../config/index.js';
import { register, login, createUser, forgotPassword, resetPassword, manualPasswordReset, getAllUsers } from '../controllers/authControllers.js';

const router = Router();

// Public routes
router.post('/login', login);
router.post('/signup', register);

// Protected routes - User creation (role-based)
router.post('/create-user', authenticateToken, checkPermission('manage_users'), createUser as any);

// Password reset routes
router.post('/forgot-password', forgotPassword); // Public - anyone can request reset

// Manual password reset route (unified) - higher user resets lower user's password by email
router.post('/reset-password', authenticateToken, manualPasswordReset as any);

export default router;
