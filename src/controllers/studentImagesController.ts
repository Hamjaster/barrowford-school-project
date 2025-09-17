import { Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// helper: fetch student record
const getStudentRecord = async (authUserId: string) => {
  return await supabase
    .from('students')
    .select('id, year_group_id')
    .eq('auth_user_id', authUserId)
    .single();
};

// student uploads an image
export const uploadStudentImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
 

    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: 'Image URL is required' });

    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });

    const { data, error } = await supabase
      .from('studentimages')
      .insert({
        student_id: student.id,
        year_group_id: student.year_group_id,
        image_url
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error('Error uploading student image:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// student gets own images
export const getMyStudentImages = async (req: AuthenticatedRequest, res: Response) => {
  try {
  

    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });

    const { data, error } = await supabase
      .from('studentimages')
      .select('id, image_url, created_at')
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching student images:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// student deletes own image
export const deleteMyStudentImage = async (req: AuthenticatedRequest, res: Response) => {
  try {
  

    const { id } = req.params;

    const { data: student } = await getStudentRecord(req.user.userId);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const { error } = await supabase
      .from('studentimages')
      .delete()
      .eq('id', id)
      .eq('student_id', student.id);

    if (error) throw error;
    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting student image:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// teacher views images of a specific student
export const getStudentImagesByTeacher = async (req: AuthenticatedRequest, res: Response) => {
  try {
 

    const { studentId } = req.params;

    const { data, error } = await supabase
      .from('studentimages')
      .select('id, image_url, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching student images for teacher:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// upper-level user deletes student image
export const deleteStudentImages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!['admin', 'staff_admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only upper-level users can delete student images' });
    }

    const { id } = req.params;

    const { error } = await supabase
      .from('studentimages')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: `Student image with ID ${id} deleted successfully` });
  } catch (err: any) {
    console.error('Error deleting student image by upper-level user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
