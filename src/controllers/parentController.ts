import { Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// Fetch all children (students) for a parent
export const getMyChildren = async (req: AuthenticatedRequest, res: Response) => {
  try {
  

    // Find parent record
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('id')
      .eq('auth_user_id', req.user.userId)
      .single();

    if (parentError || !parent) return res.status(404).json({ error: 'Parent record not found' });

    // Find all children (students) linked with this parent - only active students
    const { data: children, error: childrenError } = await supabase
      .from('parentstudentrelationship')
      .select(`
        student:students (id, first_name, last_name, username, year_group_id, class_id, created_at, status)
      `)
      .eq('parent_id', parent.id);

    if (childrenError) throw childrenError;

    // Filter out inactive students
    const activeChildren = children
      .map(c => c.student)
      .filter(student => !student.status || student.status === 'active');

    res.json({ success: true, data: activeChildren });
  } catch (err: any) {
    console.error('Error fetching children for parent:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Fetch details for a specific student
export const getChildDetails = async (req: AuthenticatedRequest, res: Response) => {
  try {
  
    const { studentId } = req.params;

    // Ensure parent actually owns this student
    const { data: parent, error: parentError } = await supabase
      .from('parents')
      .select('id')
      .eq('auth_user_id', req.user.userId)
      .single();

    if (parentError || !parent) return res.status(404).json({ error: 'Parent record not found' });

    const { data: relation, error: relationError } = await supabase
      .from('parentstudentrelationship')
      .select('id')
      .eq('parent_id', parent.id)
      .eq('student_id', studentId)
      .maybeSingle();

    if (relationError) throw relationError;
    if (!relation) return res.status(403).json({ error: 'This student does not belong to you' });

    // Fetch student details
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name, username, year_group_id, class_id, created_at, status')
      .eq('id', studentId)
      .single();

    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });

    // Check if student is active - parents cannot view inactive students
    if (student.status && student.status !== 'active') {
      return res.status(403).json({ 
        success: false,
        error: 'This student account is inactive and cannot be viewed.' 
      });
    }

    // Fetch learnings
    const { data: learnings } = await supabase
      .from('studentlearningentities')
      .select('id, title, description, attachment_url, created_at')
      .eq('student_id', studentId);

    // Fetch images
    const { data: images } = await supabase
      .from('studentimages')
      .select('id, image_url, created_at')
      .eq('student_id', studentId);

    // Fetch reflections
    const { data: reflections } = await supabase
      .from('reflections')
      .select('id, topic_id, content, attachment_url, status, created_at')
      .eq('student_id', studentId);

    res.json({
      success: true,
      data: {
        student,
        learnings: learnings || [],
        images: images || [],
        reflections: reflections || []
      }
    });
  } catch (err: any) {
    console.error('Error fetching student details for parent:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
