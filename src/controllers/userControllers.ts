import { AuthenticatedRequest } from "../middleware/auth.js";
import { Response } from "express";
import { supabase } from "../db/supabase.js";

// GET ALL USERS - Get paginated list of users with search and filters
export const getAllUsers = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const creatorRole = req.user.role;
      const creatorUserId = req.user.userId; // Get the logged-in user's ID
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        role = '', 
        sortBy = 'created_at', 
        sortOrder = 'desc' 
      } = req.query;
  
      // Only admin and staff can view all users
      if (!['admin', 'staff'].includes(creatorRole)) {
        return res.status(403).json({ 
          success: false,
          error: 'Insufficient permissions to view users' 
        });
      }
  
      // Define role hierarchy - higher roles cannot be seen by lower roles
      // Note: Users will also be filtered to exclude their own role (see query filters below)
      const roleHierarchy = {
        admin: ['staff', 'parent', 'student'], // Admin can see staff, parent, student (but not other admins)
        staff: ['staff', 'parent', 'student']  // Staff can see staff, parent, student (but not admin or other staff)
      };
  
      const allowedRoles = roleHierarchy[creatorRole as keyof typeof roleHierarchy];
      
      if (!allowedRoles) {
        return res.status(403).json({ 
          success: false,
          error: 'Invalid role permissions' 
        });
      }
  
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;
  
      // Build query
      let query = supabase
        .from('app_user')
        .select('id, email, first_name, last_name, role, created_at, auth_user_id', { count: 'exact' });
  
      // Exclude the logged-in user
      query = query.neq('auth_user_id', creatorUserId);
  
      // Filter by allowed roles only
      query = query.in('role', allowedRoles);
  
      // Exclude users with the same role as the requester
      query = query.neq('role', creatorRole);
  
      // Add search filter
      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
      }
  
      // Add role filter (only if it's within allowed roles and not the same as creator's role)
      if (role && role !== 'all' && allowedRoles.includes(role as string) && role !== creatorRole) {
        query = query.eq('role', role);
      }
  
      // Add sorting
      const validSortColumns = ['first_name', 'last_name', 'email', 'role', 'created_at'];
      const sortColumn = validSortColumns.includes(sortBy as string) ? sortBy as string : 'created_at';
      const order = sortOrder === 'asc' ? true : false;
      
      query = query.order(sortColumn, { ascending: order });
  
      // Add pagination
      query = query.range(offset, offset + limitNum - 1);
  
      const { data: users, error, count } = await query;
  
      if (error) {
        console.error('Error fetching users:', error);
        return res.status(400).json({ 
          success: false,
          error: 'Failed to fetch users' 
        });
      }
  
      // Remove auth_user_id from the response for security
      const sanitizedUsers = (users || []).map(user => {
        const { auth_user_id, ...userWithoutAuthId } = user;
        return userWithoutAuthId;
      });
  
      // Calculate pagination info
      const totalPages = Math.ceil((count || 0) / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;
  
      res.json({
        success: true,
        data: {
          users: sanitizedUsers,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalUsers: count || 0,
            usersPerPage: limitNum,
            hasNextPage,
            hasPrevPage
          }
        }
      });
  
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      res.status(500).json({ 
        success: false,
        error: 'Internal server error' 
      });
    }
  };