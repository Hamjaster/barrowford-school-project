import { Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const getAssignedStudents = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Only teachers can access assigned students' });
    }

    // Find teacher record
    const { data: teacher, error: teacherError } = await supabase
      .from('staffs')
      .select('id, year_group_id, class_id')
      .eq('auth_user_id', req.user.userId)
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ error: 'Teacher record not found' });
    }

    // Fetch students in the same year_group and class
    const { data: students, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, email, year_group_id, class_id, created_at')
      .eq('year_group_id', teacher.year_group_id)
      .eq('class_id', teacher.class_id);

    if (studentError) throw studentError;

    res.json({ success: true, data: students });
  } catch (err: any) {
    console.error('Error fetching assigned students:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
