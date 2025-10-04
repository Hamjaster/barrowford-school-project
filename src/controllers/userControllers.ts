import { AuthenticatedRequest, checkPermission } from "../middleware/auth.js";
import { Response } from "express";
import { supabase } from "../db/supabase.js";
import { canManageRole, getManageableRoles, getRoleTable, canManageUsers, UserRole } from "../utils/roleUtils.js";
import { logAudit, findUserByAuthUserId } from "../utils/lib.js";

export const getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const creatorRole = req.user.role;
    const creatorUserId = req.user.userId;

    const {
      page = 1,
      limit = 10,
      search = "",
      role = "",
      sortBy = "created_at",
      sortOrder = "desc",
    } = req.query;

    if (!canManageUsers(creatorRole as UserRole)) {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions to view users",
      });
    }

    const allowedRoles = getManageableRoles(creatorRole as UserRole);

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Map each role to its table and fields
    const roleTables: Record<string, string> = {
      admin: getRoleTable('admin'),
      staff_admin: getRoleTable('staff_admin'),
      staff: getRoleTable('staff'),
      parent: getRoleTable('parent'),
      student: getRoleTable('student'),
    };

    const validSortColumns = [
      "first_name",
      "last_name",
      "email",
      "role",
      "created_at",
    ];
    const sortColumn = validSortColumns.includes(sortBy as string)
      ? (sortBy as string)
      : "created_at";
    const order = sortOrder === "asc";

    let users: any[] = [];
    let totalCount = 0;

    for (const allowedRole of allowedRoles) {
      if (role && role !== "all" && role !== allowedRole) {
        continue; // skip if filtering by role
      }

      const table = roleTables[allowedRole];
      if (!table) continue;

      let query = supabase
        .from(table)
        .select("id, email, first_name, last_name, created_at, auth_user_id, status", {
          count: "exact",
        })
        .neq("auth_user_id", creatorUserId); // exclude current user

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      query = query.order(sortColumn, { ascending: order });

      const { data, count, error } = await query;
      if (error) throw error;

      if (data) {
        users.push(
          ...data.map((u: any) => ({
            id: u.id,
            email: u.email,
            first_name: u.first_name,
            last_name: u.last_name,
            role: allowedRole,
            created_at: u.created_at,
            status: u.status,
          }))
        );
      }

      if (count) {
        totalCount += count;
      }
    }

    // manual pagination after merging
    const paginatedUsers = users
      .sort((a, b) =>
        order
          ? a[sortColumn].localeCompare(b[sortColumn])
          : b[sortColumn].localeCompare(a[sortColumn])
      )
      .slice(offset, offset + limitNum);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.status(200).json({
      success: true,
      data: {
        users: paginatedUsers,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalUsers: totalCount,
          usersPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const toggleUserStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, role, userId } = req.body; // 'activate' | 'deactivate'
    
    console.log(role, userId, 'params')
    if (!['activate', 'deactivate'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // Get old value for audit log
    const table = role + (role.endsWith('s') ? '' : 's'); // crude pluralization
    const { data: oldData, error: oldError } = await supabase
      .from(table)
      .select('*')
      .eq('id', userId)
      .single();

    if (oldError) throw oldError;

    // Update status in correct role table
    const { data: newData, error } = await supabase
      .from(table)
      .update({ status: action === 'activate' ? 'active' : 'inactive' })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Get actual user ID for audit log
    const user = await findUserByAuthUserId(req.user.userId);
    if (!user) throw new Error('User not found');

    // Log audit for status change
    await logAudit({
      action: 'update',
      entityType: table,
      entityId: userId,
      oldValue: oldData,
      newValue: newData,
      actorId: user.id,
      actorRole: req.user.role
    });

    const capitalizedRole = role.charAt(0).toUpperCase() + role.slice(1);
    res.status(200).json({ success: true, message: `${capitalizedRole} ${action}d successfully` });  } catch (err: any) {
    console.error('Error toggling status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role, userId } = req.body;
    const currentUserRole = req.user.role;
    const currentUserId = req.user.userId;

    // Validate required fields
    if (!role || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Role and userId are required'
      });
    }

    // Prevent self-deletion
    if (userId === currentUserId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account'
      });
    }

    // Check if current user can manage the target role
    const canManage = canManageRole(currentUserRole as UserRole, role as UserRole);
    if (!canManage.allowed) {
      return res.status(403).json({
        success: false,
        error: canManage.message
      });
    }

    // Get the appropriate table for the role
    const table = getRoleTable(role as UserRole);

    // Check if user exists before deletion
    const { data: userData, error: fetchError } = await supabase
      .from(table)
      .select('id, email, first_name, last_name, auth_user_id')
      .eq('id', userId)
      .single();

    if (fetchError || !userData) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Delete from role-specific table
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .eq('id', userId);

    if (deleteError) {
      throw deleteError;
    }

    // Get actual user ID for audit log
    const user = await findUserByAuthUserId(req.user.userId);
    if (!user) throw new Error('User not found');

    // Log audit for delete action
    await logAudit({
      action: 'delete',
      entityType: table,
      entityId: userId,
      oldValue: userData,
      newValue: null,
      actorId: user.id,
      actorRole: req.user.role
    });

    // Also delete from auth.users table if auth_user_id exists
    if (userData.auth_user_id) {
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
        userData.auth_user_id
      );
      
      if (authDeleteError) {
        console.warn('Failed to delete auth user:', authDeleteError);
        // Don't fail the entire operation if auth deletion fails
      }
    }

    res.status(200).json({
      success: true,
      message: `${role} user deleted successfully`,
      deletedUser: {
        id: userData.id,
        email: userData.email,
        name: `${userData.first_name} ${userData.last_name}`
      }
    });

  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};