import { Request, Response, NextFunction } from 'express';
import { AuthUtils, JWTPayload } from '../utils/auth.js';
import { supabase } from '../db/supabase.js';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: JWTPayload;
}

// Centralized permissions system
const permissions = {
  admin: [
    "manage_users",
    "get_users",
    "manage_student_images"
  ],
  staff_admin: [
    "manage_users",
    "get_users",
    "manage_student_images"
  ],
  staff: [
    "manage_users",
    "get_users",
    "manage_student_images",
    "get_assigned_students",
    "create-reflection-topic",
    "fetch-all-topics",
    "update-reflection-topic",
    "delete-reflection-topic",
    "all-reflections",
    "update-reflections",
    "delete-reflections",
    "add-comments",
    "fetch-comments",
    "moderate_content",
    "get-student-reflections",
    "view_teacher_profile",
    "update_student_profile_photo"
  ],
  parent: [
    "view_children",
    "add-comments",
    "get-student-reflections",
    "fetch-comments"
  ],
  student: [
    "manage_personal_section",
    "manage_student_pages",
    "manage_own_images",
    "get-active-topics",
    "create-reflection",
    "fetch-my-reflections",
    "fetch-comments",
    "fetch-all-topics",
    "get_student_details"
  ]
};

// Permission checking middleware
export const checkPermission = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const role = req.user.role;
    const userPermissions = permissions[role as keyof typeof permissions];

    if (userPermissions?.includes(requiredPermission)) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: `Forbidden: Insufficient permissions. Required permission: ${requiredPermission}`
    });
  };
};

export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token required'
      });
      return;
    }

    const decoded = AuthUtils.verifyAccessToken(token);

    // CHeck if the the user is a student and if the account is active
    if (decoded.role === 'student') {
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("status")
        .eq("auth_user_id", decoded.authUserId)
        .single();

      if (studentError || !student) {
        res.status(404).json({ success : false, error: 'Student record not found' });
        return;
      }

      if (student.status && student.status !== 'active') {
        res.status(403).json({ success : false,error: 'Student account is inactive' });
        return;
      }
    }


    // With the new JWT structure, we have both userId and authUserId
    // We can trust the JWT payload since it's signed and verified
    // No need to query the database for user verification in middleware
    // The userId in the JWT is the actual user record ID, authUserId is the auth table ID

    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};
// Legacy role-based middlewares (kept for backward compatibility if needed)
// You can remove these if not used elsewhere in the codebase
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};
