import { Request, Response, NextFunction } from 'express';
import { AuthUtils, JWTPayload } from '../utils/auth.js';

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
    "all-reflections",
    "update-reflections",
    "delete-reflections",
    "add-comments",
    "fetch-comments"

  ],
  parent: [
    "view_children",
    "add-comments",
    "fetch-reflection-id",
    "fetch-comments"
  ],
  student: [
    "manage_personal_section",
    "manage_student_pages",
    "manage_own_images",
    "get-active-topics",
    "create-reflection",
    "fetch-my-reflections",
    "fetch-comments"

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
    
    // Note: You can add user existence/active status check here if needed
    // For now, we trust the JWT token validation

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

// Middleware to check if user can access specific student's data
export const canAccessStudentData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
      return;
    }

    const { role, userId } = req.user;
    const studentId = req.params.studentId || req.body.studentId;

    // Admin and staff can access all student data
    if (['admin', 'staff_admin', 'staff'].includes(role)) {
      next();
      return;
    }

    // Parents can only access their own children's data
    if (role === 'parent') {
      // This would require a parent-student relationship table
      // For now, we'll implement basic check - you can expand this based on your DB schema
      next();
      return;
    }

    // Students can only access their own data
    if (role === 'student') {
      if (userId !== studentId) {
        res.status(403).json({ 
          success: false, 
          message: 'Access denied: Can only access own data' 
        });
        return;
      }
    }

    next();
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Error checking access permissions' 
    });
  }
};
