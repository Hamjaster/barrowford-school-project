import { Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { profile } from 'console';

export const getStudentDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can access their details' });
    }

    console.log("🔍 userId from token:", req.user.userId);
    console.log(req.user, 'req.user');

    // 1️⃣ Fetch student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, dob, year_group_id, class_id, hair_color, height,profile_photo')
      .eq('auth_user_id', req.user.authUserId)
      .single();

    if (studentError || !student) {
      console.error("❌ Supabase error:", studentError);
      return res.status(404).json({ error: 'Student not found' });
    }

    // 2️⃣ Fetch class name using class_id
    let className = null;
    if (student.class_id) {
      const { data: classRow, error: classError } = await supabase
        .from('classes')
        .select('name')
        .eq('id', student.class_id)
        .single();
      if (classError) {
        console.warn('⚠️ Class not found:', classError);
      } else {
        className = classRow?.name || null;
      }
    }

    // 3️⃣ Compute derived fields
    const fullName = `${student.first_name} ${student.last_name}`;
    const age = student.dob ? new Date().getFullYear() - new Date(student.dob).getFullYear() : null;

    // 4️⃣ Return only the requested fields
    return res.status(200).json({
      success: true,
      data: {
        name: fullName,
        age,
        year_group_id: student.year_group_id,
        class_id: student.class_id,
        class_name: className,
        hair_color : student.hair_color,
        eye_color: null, // 👈 not present in your table
        height: student.height,
        profile_photo:student.profile_photo
      },
    });
  } catch (err) {
    console.error('Error fetching student details:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
