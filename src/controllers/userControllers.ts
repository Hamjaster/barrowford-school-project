import { AuthenticatedRequest } from "../middleware/auth.js";
import { Response } from "express";
import { supabase } from "../db/supabase.js";

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

    if (!["admin", "staff_admin", "staff"].includes(creatorRole)) {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions to view users",
      });
    }

    const roleHierarchy = {
      admin: ["staff_admin", "staff", "parent", "student"],
      staff_admin: ["staff", "parent", "student"],
      staff: ["parent", "student"],
    };

    const allowedRoles = roleHierarchy[creatorRole as keyof typeof roleHierarchy];
    if (!allowedRoles) {
      return res.status(403).json({
        success: false,
        error: "Invalid role permissions",
      });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Map each role to its table and fields
    const roleTables: Record<string, string> = {
      admin: "admins",
      staff_admin: "staff_admins",
      staff: "staffs",
      parent: "parents",
      student: "students",
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
        .select("id, email, first_name, last_name, created_at, auth_user_id", {
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

    res.json({
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
