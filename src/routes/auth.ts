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
import { register, login, createUser, forgotPassword, resetPassword, manualPasswordReset } from '../controllers/authControllers.js';

const router = Router();
const emailService = new EmailService();

// Public routes
router.post('/login', login);
router.post('/signup', register);

// Protected routes - User creation (role-based)
router.post('/create-user', authenticateToken, checkPermission('manage_users'), createUser as any);

// Password reset routes
router.post('/forgot-password', forgotPassword); // Public - anyone can request reset
// This would be handled by the client side
// router.post('/reset-password-token', resetPassword); // Public - reset with token

// Manual password reset route (unified) - higher user resets lower user's password by email
router.post('/reset-password', authenticateToken, manualPasswordReset as any);

// Refresh token endpoint
// router.post('/refresh-token', asyncHandler(async (req, res) => {
//   const { refreshToken } = req.bod;

//   if (!refreshToken) {
//     throw new AppError('Refresh token required', 401);
//   }

//   try {
//     const decoded = AuthUtils.verifyRefreshToken(refreshToken);
    
//     // Verify user still exists and is active
//     const foundUser = await db.user.findUnique({
//       where: { id: decoded.userId },
//     });

//     if (!foundUser || !foundUser.isActive) {
//       throw new AppError('Invalid refresh token', 401);
//     }

//     // Generate new access token
//     const accessToken = AuthUtils.generateAccessToken({
//       userId: foundUser.id,
//       email: foundUser.email || undefined,
//       username: foundUser.username || undefined,
//       role: foundUser.role,
//     });

//     res.json({
//       success: true,
//       message: 'Token refreshed successfully',
//       data: {
//         accessToken,
//       },
//     });
//   } catch (error) {
//     throw new AppError('Invalid or expired refresh token', 401);
//   }
// }));

// Password reset request
// router.post('/forgot-password', validate(passwordResetRequestSchema), asyncHandler(async (req, res) => {
//   const { email } = req.body;

//   const foundUser = await db.user.findUnique({
//     where: { email },
//     include: {
//       staff: true,
//       parent: true,
//       child: true,
//     },
//   });

//   // Always return success to prevent email enumeration
//   if (!foundUser) {
//     res.json({
//       success: true,
//       message: 'If an account with this email exists, a password reset link has been sent.',
//     });
//     return;
//   }

//   // Generate reset token
//   const resetToken = AuthUtils.generatePasswordResetToken();
//   const resetExpires = new Date(Date.now() + config.passwordReset.tokenExpiryHours * 60 * 60 * 1000);

//   // Save reset token
//   await db.user.update({
//     where: { id: foundUser.id },
//     data: {
//       passwordResetToken: resetToken,
//       passwordResetExpires: resetExpires,
//     },
//   });

//   // Get user's display name
//   let userName = foundUser.email || foundUser.username || 'User';
  
//   if (foundUser.staff) {
//     userName = `${foundUser.staff.firstName} ${foundUser.staff.lastName}`;
//   } else if (foundUser.parent) {
//     userName = `${foundUser.parent.firstName} ${foundUser.parent.lastName}`;
//   } else if (foundUser.child) {
//     userName = `${foundUser.child.firstName} ${foundUser.child.lastName}`;
//   }

//   // Send reset email
//   try {
//     await emailService.sendPasswordResetEmail(foundUser.email!, resetToken, userName);
//   } catch (error) {
//     console.error('Failed to send password reset email:', error);
//     // Don't throw error to prevent revealing email existence
//   }

//   res.json({
//     success: true,
//     message: 'If an account with this email exists, a password reset link has been sent.',
//   });
// }));

// Password reset
// router.post('/reset-password', validate(passwordResetSchema), asyncHandler(async (req, res) => {
//   const { token, newPassword } = req.body;

//   const foundUser = await db.user.findFirst({
//     where: {
//       passwordResetToken: token,
//     },
//   });

//   if (!foundUser) {
//     throw new AppError('Invalid or expired reset token', 400);
//   }

//   // Check if token has expired
//   if (!foundUser.passwordResetExpires || foundUser.passwordResetExpires < new Date()) {
//     throw new AppError('Reset token has expired', 400);
//   }

//   // Validate password strength
//   const passwordValidation = AuthUtils.validatePassword(newPassword);
//   if (!passwordValidation.isValid) {
//     throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
//   }

//   // Hash new password
//   const hashedPassword = await AuthUtils.hashPassword(newPassword);

//   // Update password and clear reset token
//   await db.user.update({
//     where: { id: foundUser.id },
//     data: {
//       passwordHash: hashedPassword,
//       passwordResetToken: null,
//       passwordResetExpires: null,
//     },
//   });

//   res.json({
//     success: true,
//     message: 'Password has been reset successfully',
//   });
// }));

// // Change password (for authenticated users)
// router.post('/change-password', authenticateToken, validate(changePasswordSchema), asyncHandler(async (req, res) => {
//   const { currentPassword, newPassword } = req.body;
//   const userId = req.user!.userId;

//   // Get current user
//   const foundUser = await db.user.findUnique({
//     where: { id: userId },
//   });

//   if (!foundUser) {
//     throw new AppError('User not found', 404);
//   }

//   // Verify current password
//   const isCurrentPasswordValid = await AuthUtils.comparePassword(currentPassword, foundUser.passwordHash);
//   if (!isCurrentPasswordValid) {
//     throw new AppError('Current password is incorrect', 400);
//   }

//   // Validate new password strength
//   const passwordValidation = AuthUtils.validatePassword(newPassword);
//   if (!passwordValidation.isValid) {
//     throw new AppError(`Password validation failed: ${passwordValidation.errors.join(', ')}`, 400);
//   }

//   // Check if new password is different from current
//   const isSamePassword = await AuthUtils.comparePassword(newPassword, foundUser.passwordHash);
//   if (isSamePassword) {
//     throw new AppError('New password must be different from current password', 400);
//   }

//   // Hash new password
//   const hashedPassword = await AuthUtils.hashPassword(newPassword);

//   // Update password
//   await db.user.update({
//     where: { id: userId },
//     data: {
//       passwordHash: hashedPassword,
//     },
//   });

//   res.json({
//     success: true,
//     message: 'Password changed successfully',
//   });
// }));

// // Get current user profile
// router.get('/me', authenticateToken, asyncHandler(async (req, res) => {
//   const userId = req.user!.userId;

//   const foundUser = await db.user.findUnique({
//     where: { id: userId },
//     include: {
//       staff: true,
//       parent: true,
//       child: true,
//     },
//   });

//   if (!foundUser) {
//     throw new AppError('User not found', 404);
//   }
  
//   let userInfo: any = {
//     id: foundUser.id,
//     email: foundUser.email,
//     username: foundUser.username,
//     role: foundUser.role,
//     emailVerified: foundUser.emailVerified,
//     lastLogin: foundUser.lastLogin,
//     isActive: foundUser.isActive,
//     createdAt: foundUser.createdAt,
//   };

//   // Get role-specific profile information
//   if (foundUser.staff) {
//     userInfo.profile = foundUser.staff;
//   } else if (foundUser.parent) {
//     userInfo.profile = foundUser.parent;
//   } else if (foundUser.child) {
//     userInfo.profile = foundUser.child;
//   }

//   res.json({
//     success: true,
//     data: userInfo,
//   });
// }));

// // Logout (client-side token removal, but we can log it)
// router.post('/logout', authenticateToken, asyncHandler(async (req, res) => {
//   // In a more sophisticated setup, you might want to blacklist the token
//   // For now, we'll just log the logout
//   console.log(`User ${req.user!.userId} logged out at ${new Date().toISOString()}`);

//   res.json({
//     success: true,
//     message: 'Logged out successfully',
//   });
// }));

export default router;
