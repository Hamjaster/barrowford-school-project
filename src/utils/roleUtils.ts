/**
 * Role hierarchy and permission utilities
 * Centralized logic for role-based access control
 */

export type UserRole = 'admin' | 'staff_admin' | 'staff' | 'parent' | 'student';

// Define the role hierarchy - higher roles can manage lower roles
export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  admin: ['staff_admin', 'staff', 'parent', 'student'],
  staff_admin: ['staff', 'parent', 'student'],
  staff: ['parent', 'student'],
  parent: [], // Parents cannot manage other users
  student: [] // Students cannot manage other users
};

// Map roles to their respective database tables
export const ROLE_TABLES: Record<UserRole, string> = {
  admin: "admins",
  staff_admin: "staff_admins",
  staff: "staffs",
  parent: "parents",
  student: "students"
};

// All valid roles
export const ALL_ROLES: UserRole[] = ['admin', 'staff_admin', 'staff', 'parent', 'student'];

/**
 * Check if a user with the given role can manage users with the target role
 * @param currentUserRole - The role of the current user
 * @param targetRole - The role of the user to be managed
 * @returns Object with allowed status and message
 */
export const canManageRole = (currentUserRole: UserRole, targetRole: UserRole): { allowed: boolean; message: string } => {
  // Admin users cannot be managed by anyone
  if (targetRole === 'admin') {
    return {
      allowed: false,
      message: 'Admin users cannot be managed'
    };
  }

  const allowedRoles = ROLE_HIERARCHY[currentUserRole];
  
  if (!allowedRoles || !allowedRoles.includes(targetRole)) {
    return {
      allowed: false,
      message: `${currentUserRole} cannot manage ${targetRole} accounts`
    };
  }

  return { allowed: true, message: '' };
};

/**
 * Get all roles that a user can manage
 * @param currentUserRole - The role of the current user
 * @returns Array of roles that can be managed
 */
export const getManageableRoles = (currentUserRole: UserRole): UserRole[] => {
  return ROLE_HIERARCHY[currentUserRole] || [];
};

/**
 * Check if a role is valid
 * @param role - The role to validate
 * @returns True if the role is valid
 */
export const isValidRole = (role: string): role is UserRole => {
  return ALL_ROLES.includes(role as UserRole);
};

/**
 * Get the database table name for a given role
 * @param role - The user role
 * @returns The corresponding database table name
 */
export const getRoleTable = (role: UserRole): string => {
  return ROLE_TABLES[role];
};

/**
 * Check if a user can perform management operations (create, update, delete)
 * @param currentUserRole - The role of the current user
 * @returns True if the user can manage other users
 */
export const canManageUsers = (currentUserRole: UserRole): boolean => {
  return ['admin', 'staff_admin', 'staff'].includes(currentUserRole);
};
