import { AuthenticatedRequest, checkPermission } from "../middleware/auth.js";
import { Response } from "express";
import { supabase } from "../db/supabase.js";
import { canManageRole, getManageableRoles, getRoleTable, canManageUsers, UserRole } from "../utils/roleUtils.js";
import { logAudit } from "../utils/lib.js";

// Get student assignment details (parents and teacher)
export const getStudentAssignments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    
    if (!canManageUsers(req.user.role as UserRole)) {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions to view student assignments",
        });
    }

    // Get student details
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, username, current_year_group_id, class_id, status')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Get assigned parents
    const { data: parentRelationships, error: parentError } = await supabase
      .from('parent_student_relationships')
      .select(`
        parent:parents (
          id,
          first_name,
          last_name,
          email,
          status
        )
      `)
      .eq('student_id', studentId);

    if (parentError) throw parentError;

    const assignedParents = parentRelationships?.map((rel: any) => rel.parent).filter(Boolean) || [];

    // Get assigned teacher (staff with same year_group_id and class_id)
    const { data: teacher, error: teacherError } = await supabase
      .from('staffs')
      .select('id, first_name, last_name, email, year_group_id, class_id, status')
      .eq('year_group_id', student.current_year_group_id)
      .eq('class_id', student.class_id)
      .single();

    if (teacherError && teacherError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw teacherError;
    }

    // Get available parents (all active parents not already assigned to this student)
    const { data: allParents, error: allParentsError } = await supabase
      .from('parents')
      .select('id, first_name, last_name, email, status')
      .eq('status', 'active');

    if (allParentsError) throw allParentsError;

    const assignedParentIds = assignedParents.map((p: any) => p.id);
    const availableParents = allParents?.filter((p: any) => !assignedParentIds.includes(p.id)) || [];

    // Get available teachers (all active staff with same year_group_id)
    const { data: availableTeachers, error: availableTeachersError } = await supabase
      .from('staffs')
      .select('id, first_name, last_name, email, year_group_id, class_id, status')
      .eq('status', 'active')
      .eq('year_group_id', student.current_year_group_id);

    if (availableTeachersError) throw availableTeachersError;

    res.status(200).json({
      success: true,
      data: {
        student,
        assignedParents,
        assignedTeacher: teacher || null,
        availableParents,
        availableTeachers
      }
    });

  } catch (error: any) {
    console.error('Error getting student assignments:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Assign parents to student
export const assignParentsToStudent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const { parentIds } = req.body;

    if (!canManageUsers(req.user.role as UserRole)) {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions to assign parents",
      });
    }

    if (!Array.isArray(parentIds) || parentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Parent IDs array is required'
      });
    }

    // Verify student exists
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Verify all parents exist and are active
    console.log(parentIds, 'parentIds !!');
    const { data: parents, error: parentsError } = await supabase
      .from('parents')
      .select('id, first_name, last_name, email, status')
      .in('id', parentIds)
      .eq('status', 'active');
    console.log(parents, parentsError, 'parents !!');
    if (parentsError) throw parentsError;

    if (parents?.length !== parentIds.length) {
      return res.status(400).json({
        success: false,
        error: 'One or more parents not found or inactive'
      });
    }

    // Remove existing relationships for this student
    const { error: deleteError } = await supabase
      .from('parent_student_relationships')
      .delete()
      .eq('student_id', studentId);

    if (deleteError) throw deleteError;

    // Create new relationships
    const relationships = parentIds.map((parentId: number) => ({
      parent_id: parentId,
      student_id: parseInt(studentId)
    }));

    const { error: insertError } = await supabase
      .from('parent_student_relationships')
      .insert(relationships);

    if (insertError) throw insertError;

    // Log audit
    await logAudit({
      action: 'create',
      entityType: 'parent_student_relationships',
      entityId: studentId,
      oldValue: null,
      newValue: { studentId, parentIds },
      actorId: req.user.userId,
      actorRole: req.user.role
    });

    res.status(200).json({
      success: true,
      message: `Successfully assigned ${parentIds.length} parent(s) to student`,
      data: {
        studentId,
        assignedParents: parents
      }
    });

  } catch (error: any) {
    console.error('Error assigning parents to student:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Assign teacher to student (by updating student's class_id to match teacher's class_id)
export const assignTeacherToStudent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const { teacherId } = req.body;

    if (!canManageUsers(req.user.role as UserRole)) {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions to assign teachers",
      });
    }

    if (!teacherId) {
      return res.status(400).json({
        success: false,
        error: 'Teacher ID is required'
      });
    }

    // Get student details
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, current_year_group_id, class_id')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Get teacher details
    const { data: teacher, error: teacherError } = await supabase
      .from('staffs')
      .select('id, first_name, last_name, email, year_group_id, class_id, status')
      .eq('id', teacherId)
      .eq('status', 'active')
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({
        success: false,
        error: 'Teacher not found or inactive'
      });
    }

    // Check if teacher's year_group_id matches student's year_group_id
    if (teacher.year_group_id !== student.current_year_group_id) {
      return res.status(400).json({
        success: false,
        error: 'Teacher and student must be in the same year group'
      });
    }

    // Update student's class_id to match teacher's class_id
    const { data: updatedStudent, error: updateError } = await supabase
      .from('students')
      .update({ class_id: teacher.class_id })
      .eq('id', studentId)
      .select('id, first_name, last_name, current_year_group_id, class_id')
      .single();

    if (updateError) throw updateError;

    // Log audit
    await logAudit({
      action: 'update',
      entityType: 'students',
      entityId: studentId,
      oldValue: { class_id: student.class_id },
      newValue: { class_id: teacher.class_id },
      actorId: req.user.userId,
      actorRole: req.user.role
    });

    res.status(200).json({
      success: true,
      message: 'Successfully assigned teacher to student',
      data: {
        student: updatedStudent,
        teacher
      }
    });

  } catch (error: any) {
    console.error('Error assigning teacher to student:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Remove teacher assignment (set class_id to null)
export const removeTeacherFromStudent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { studentId } = req.params;

    if (!canManageUsers(req.user.role as UserRole)) {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions to remove teacher assignments",
      });
    }

    // Get student details
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, current_year_group_id, class_id')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({
        success: false,
        error: 'Student not found'
      });
    }

    // Update student's class_id to null
    const { data: updatedStudent, error: updateError } = await supabase
      .from('students')
      .update({ class_id: null })
      .eq('id', studentId)
      .select('id, first_name, last_name, current_year_group_id, class_id')
      .single();

    if (updateError) throw updateError;

    // Log audit
    await logAudit({
      action: 'update',
      entityType: 'students',
      entityId: studentId,
      oldValue: { class_id: student.class_id },
      newValue: { class_id: null },
      actorId: req.user.userId,
      actorRole: req.user.role
    });

    res.status(200).json({
      success: true,
      message: 'Successfully removed teacher assignment from student',
      data: {
        student: updatedStudent
      }
    });

  } catch (error: any) {
    console.error('Error removing teacher from student:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
