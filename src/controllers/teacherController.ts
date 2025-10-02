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
      .select('id, first_name, last_name, email, year_group_id, class_id, created_at, status')
      .eq('year_group_id', teacher.year_group_id)
      .eq('status', 'active')
      .eq('class_id', teacher.class_id);

    if (studentError) throw studentError;

    res.status(200).json({ success: true, data: students });
  } catch (err: any) {
    console.error('Error fetching assigned students:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


export const getTeacherProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Only teachers can access their profile' });
    }


    const { data: teacher, error: teacherError } = await supabase
      .from('staffs')
      .select('id, year_group_id, class_id, created_at, auth_user_id, first_name, last_name, email, status')
      .eq('auth_user_id', req.user.userId)
      .single();

    if (teacherError || !teacher) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }


    let className = null;
    if (teacher.class_id) {
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('name')
        .eq('id', teacher.class_id)
        .single();

      if (!classError && classData) {
        className = classData.name;
      }
    }

    res.json({
      success: true,
      teacher: {
        ...teacher,
        class_name: className,
      },

    });

  } catch (err: any) {
    console.error('Error fetching teacher profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};