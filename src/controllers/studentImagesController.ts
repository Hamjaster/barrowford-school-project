import { Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit, findUserByAuthUserId } from '../utils/lib.js';

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
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can upload images' });
    }
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: 'Image URL required' });

    // get student
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('auth_user_id', req.user.userId)
      .single();
    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });

    // create moderation - action_type = 'create'
    const newContent = {
      student_id: student.id,
      year_group_id: student.year_group_id,
      image_url
    };

    const { data: moderation, error: modErr } = await supabase
      .from('moderations')
      .insert({
        student_id: student.id,
        entity_type: 'studentimages',
        year_group_id: student.year_group_id,
        class_id: student.class_id,
        entity_id: null,
        old_content: null,
        new_content: newContent,
        new_attachment: image_url,
        action_type: 'create',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (modErr) throw modErr;

    res.status(201).json({ success: true, message: 'Image submitted for moderation', data: moderation });
  } catch (err) {
    console.error('uploadStudentImage error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
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
    // no inline permission check - middleware
    const { id } = req.params;

    // get student
    const { data: studentRow, error: studentErr } = await supabase
      .from('students')
      .select('*')
      .eq('auth_user_id', req.user.userId)
      .single();
    if (studentErr || !studentRow) return res.status(404).json({ error: 'Student not found' });

    // fetch current image row to store old_content
    const { data: imageRow, error: imageErr } = await supabase
      .from('studentimages')
      .select('*')
      .eq('id', id)
      .eq('student_id', studentRow.id)
      .single();

    if (imageErr || !imageRow) return res.status(404).json({ error: 'Image not found' });

    // create moderation (delete)
    const { data: moderation, error: modErr } = await supabase
      .from('moderations')
      .insert({
        student_id: studentRow.id,
        year_group_id: studentRow.year_group_id,
        class_id: studentRow.class_id,
        entity_type: 'studentimages',
        entity_id: id,
        old_content: imageRow,
        old_attachment: imageRow.image_url,
        new_content: null,
        action_type: 'delete',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (modErr) throw modErr;

    res.json({ success: true, message: 'Deletion submitted for moderation', data : moderation });
  } catch (err) {
    console.error('deleteMyStudentImage error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
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

    // Get old value for audit log
    const { data: oldData, error: oldError } = await supabase
      .from('studentimages')
      .select('*')
      .eq('id', id)
      .single();

    if (oldError) throw oldError;

    const { error } = await supabase
      .from('studentimages')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Get actual user ID for audit log
    const user = await findUserByAuthUserId(req.user.userId);
    if (!user) throw new Error('User not found');

    // Log audit for delete action
    await logAudit({
      action: 'delete',
      entityType: 'studentimages',
      entityId: id,
      oldValue: oldData,
      newValue: null,
      actorId: user.id,
      actorRole: req.user.role
    });

    res.json({ success: true, message: `Student image with ID ${id} deleted successfully` });
  } catch (err: any) {
    console.error('Error deleting student image by upper-level user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
