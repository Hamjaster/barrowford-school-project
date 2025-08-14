# 🔐 Centralized Permission System Guide

## Overview

This system provides a clean, centralized way to manage permissions across different user roles in the school portal.

## Permission Structure

```javascript
const permissions = {
  admin: [
    "manage_users",
    "create_staff_admin",
    "create_staff",
    "create_parent",
    "create_student",
    "reset_all_passwords",
    "view_all_data",
    "manage_system",
  ],
  staff_admin: [
    "manage_users",
    "create_staff",
    "create_parent",
    "create_student",
    "reset_staff_passwords",
    "reset_parent_passwords",
    "reset_student_passwords",
    "view_school_data",
    "manage_classes",
  ],
  staff: [
    "create_parent",
    "create_student",
    "reset_parent_passwords",
    "reset_student_passwords",
    "view_class_data",
    "manage_assignments",
    "grade_assignments",
  ],
  parent: ["view_own_children", "view_child_progress", "communicate_teachers"],
  student: ["view_own_progress", "view_assignments", "submit_assignments"],
};
```

## Usage Examples

### 1. Basic Route Protection

```javascript
// User creation - requires "manage_users" permission
router.post(
  "/create-user",
  authenticateToken,
  checkPermission("manage_users"),
  createUser
);

// Assignment grading - requires "grade_assignments" permission
router.post(
  "/grade-assignment",
  authenticateToken,
  checkPermission("grade_assignments"),
  gradeAssignment
);

// View progress - requires "view_own_progress" permission
router.get(
  "/my-progress",
  authenticateToken,
  checkPermission("view_own_progress"),
  getProgress
);
```

### 2. Multiple Permission Routes

```javascript
// Password reset routes with different permission levels
router.post(
  "/reset-staff-password",
  authenticateToken,
  checkPermission("reset_staff_passwords"),
  resetStaffPassword
);
router.post(
  "/reset-parent-password",
  authenticateToken,
  checkPermission("reset_parent_passwords"),
  resetParentPassword
);
router.post(
  "/reset-student-password",
  authenticateToken,
  checkPermission("reset_student_passwords"),
  resetStudentPassword
);
```

### 3. Adding New Permissions

To add new permissions:

1. **Add to permissions object:**

```javascript
const permissions = {
  admin: [...existing, "new_permission"],
  staff: [...existing, "new_permission"],
};
```

2. **Use in routes:**

```javascript
router.post(
  "/new-feature",
  authenticateToken,
  checkPermission("new_permission"),
  newFeatureHandler
);
```

## Role Hierarchy & User Creation

### Creation Permissions

- **Admin**: Can create `staff_admin`, `staff`, `parent`, `student`
- **Staff Admin**: Can create `staff`, `parent`, `student`
- **Staff**: Can create `parent`, `student`

### Current Implementation

```javascript
// All use "manage_users" permission but with additional role validation
router.post(
  "/create-user",
  authenticateToken,
  checkPermission("manage_users"),
  createUser
);
```

## Benefits

✅ **Centralized Management**: All permissions in one place  
✅ **Easy to Understand**: Clear permission names  
✅ **Flexible**: Easy to add/remove permissions  
✅ **Maintainable**: Changes in one location  
✅ **Scalable**: Can handle complex permission requirements

## Permission Categories

### User Management

- `manage_users` - Create/manage user accounts
- `create_staff_admin`, `create_staff`, `create_parent`, `create_student` - Specific creation rights

### Password Management

- `reset_all_passwords` - Reset any user's password
- `reset_staff_passwords`, `reset_parent_passwords`, `reset_student_passwords` - Role-specific resets

### Data Access

- `view_all_data` - Full system access
- `view_school_data` - School-wide data access
- `view_class_data` - Class-specific data
- `view_own_progress` - Personal progress only
- `view_own_children` - Parent's children data

### Academic Features

- `manage_assignments` - Create/edit assignments
- `grade_assignments` - Grade student work
- `submit_assignments` - Submit student work
- `view_assignments` - View assigned work

### Communication

- `communicate_teachers` - Parent-teacher communication

### System Administration

- `manage_system` - System-level administration
- `manage_classes` - Class management functions

## Migration from Old System

The old role-based middleware (`requireAdmin`, `requireStaff`, etc.) is kept for backward compatibility but new features should use the permission-based system.

**Old Way:**

```javascript
router.post("/admin-only", authenticateToken, requireAdmin, handler);
```

**New Way:**

```javascript
router.post(
  "/admin-feature",
  authenticateToken,
  checkPermission("manage_system"),
  handler
);
```
