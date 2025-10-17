import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/lib.js';

// FOR MANAGERS (admin, staff, staff_admin)
export const createSubject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const { data, error } = await supabase
      .from('subjects')
      .insert({ name, description, status: 'active' })
      .select()
      .single();

    if (error) throw error;
    
    // Get actual user ID for audit log
    // userId in JWT is the actual user record ID
    
    // Log audit for create action
    await logAudit({
      action: 'create',
      entityType: 'subjects',
      entityId: data.id,
      oldValue: null,
      newValue: data,
      actorId: req.user.userId,
      actorRole: req.user.role
    });

    res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error('Error creating subject:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSubject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Get old value for audit log
    const { data: oldData, error: oldError } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();

    if (oldError) throw oldError;

    const { data, error } = await supabase
      .from('subjects')
      .update({ name, description })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Get actual user ID for audit log
    // userId in JWT is the actual user record ID

    // Log audit for update action
    await logAudit({
      action: 'update',
      entityType: 'subjects',
      entityId: id,
      oldValue: oldData,
      newValue: data,
      actorId: req.user.userId,
      actorRole: req.user.role
    });

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error updating subject:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSubject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get old value for audit log
    const { data: oldData, error: oldError } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();

    if (oldError) throw oldError;

    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Get actual user ID for audit log
    // userId in JWT is the actual user record ID

    // Log audit for delete action
    await logAudit({
      action: 'delete',
      entityType: 'subjects',
      entityId: id,
      oldValue: oldData,
      newValue: null,
      actorId: req.user.userId,
      actorRole: req.user.role
    });

    res.status(200).json({ success: true, message: 'Subject deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting subject:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllSubjects = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('status', 'active') // Only return active subjects
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching subjects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Activate subject
export const toggleSubjectStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
const {status} = req.body;
    // validate the status that it shall be active or inactive
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get old value for audit log
    const { data: oldData, error: oldError } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();

    if (oldError) throw oldError;

    const { data, error } = await supabase
      .from('subjects')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Get actual user ID for audit log
    // userId in JWT is the actual user record ID

    // Log audit for status change
    await logAudit({
      action: 'update',
      entityType: 'subjects',
      entityId: id,
      oldValue: oldData,
      newValue: data,
      actorId: req.user.userId,
      actorRole: req.user.role
    });

    res.status(200).json({ success: true, message: 'Subject status toggled successfully', data });
  } catch (err: any) {
    console.error('Error toggling subject status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all year groups
export const getAllyear_groups = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('year_groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching year groups:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all classes
export const getAllClasses = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching classes:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all subjects under a specific year group
export const getSubjectsByYearGroup = async (req: Request, res: Response) => {
  try {
    const { yearGroupId } = req.params;

    if (!yearGroupId) {
      return res.status(400).json({ error: 'Year group ID is required' });
    }

    const { data, error } = await supabase
      .from('year_group_subjects')
      .select(`
        subjects (
          id,
          name,
          status,
          created_at
        )
      `)
      .eq('year_group_id', yearGroupId);

    if (error) throw error;

    // Extract subjects from the joined data and filter only active subjects
    const subjects = data
      .map((item: any) => item.subjects)
      .filter((subject: any) => subject != null && subject.status === 'active');

    res.status(200).json({ success: true, data: subjects });
  } catch (err: any) {
    console.error('Error fetching subjects by year group:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get eligible year groups for a student based on their current enrollment year
export const getEligibleYearGroupsForStudent = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get student's current year group and enrollment date using auth user ID
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('year_group_id, created_at')
      .eq('auth_user_id', req.user.authUserId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    if (!student.year_group_id) {
      return res.status(400).json({ error: 'Student does not have a current year group assigned' });
    }

    // Get all year groups with their subjects in a single query
    const { data: allYearGroupsWithSubjects, error: yearGroupsError } = await supabase
      .from('year_groups')
      .select(`
        *,
        year_group_subjects (
          subjects (
            id,
            name,
            status,
            created_at
          )
        )
      `)
      .order('id', { ascending: true });

    if (yearGroupsError) {
      throw yearGroupsError;
    }

    // Determine eligible year groups based on enrollment logic
    // Students can see all year groups from EYFS (id=1) up to their current year group
    // This handles both scenarios:
    // 1. Student enrolled in EYFS and upgraded to Year 2 -> sees EYFS, Year 1, Year 2
    // 2. Student directly enrolled in Year 2 -> sees EYFS, Year 1, Year 2 (same result)
    const eligibleYearGroupsWithSubjects = allYearGroupsWithSubjects
      .filter((yearGroup: any) => {
        // EYFS is id=1, Year 1 is id=2, Year 2 is id=3, etc.
        // Students can access all years from EYFS up to their current year
        return yearGroup.id >= 1 && yearGroup.id <= student.year_group_id;
      })
      .map((yearGroup: any) => {
        // Extract subjects from the joined data and filter only active subjects
        const subjects = yearGroup.year_group_subjects
          .map((item: any) => item.subjects)
          .filter((subject: any) => subject != null && subject.status === 'active');

        return {
          id: yearGroup.id,
          name: yearGroup.name,
          description: yearGroup.description,
          created_at: yearGroup.created_at,
          subjects: subjects
        };
      });

    res.status(200).json({ 
      success: true, 
      data: eligibleYearGroupsWithSubjects,
      studentCurrentYear: student.year_group_id,
      studentEnrollmentDate: student.created_at
    });
  } catch (err: any) {
    console.error('Error fetching eligible year groups for student:', err);
    res.status(500).json({ error: 'Internal server error' });
  }

};
