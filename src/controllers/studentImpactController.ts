import { Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// helper to fetch student
const getStudentRecord = async (userId: string) => {
  return await supabase
    .from('students')
    .select('*')
    .eq('id', userId)
    .single();
};

// Add new impact (student only)
export const addStudentImpact = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can add impacts' });
    }

    const { title, content, attachment_url } = req.body;
    if (!title || (!content && !attachment_url)) {
      return res.status(400).json({ error: 'Title and either content or attachment is required' });
    }

    // find student
    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });
    
    const { year_group_id } = req.body;
    if (!year_group_id) {
      return res.status(400).json({ error: 'Year group ID is required' });
    }
    
    // Create impact record with pending status
    const { data: impact, error: impactErr } = await supabase
      .from('student_impacts')
      .insert({
        student_id: student.id,
        year_group_id: year_group_id,
        title,
        description: content,
        attachment_url,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (impactErr) throw impactErr;

    // Create moderation record for teacher review
    const { data: moderation, error: modErr } = await supabase
      .from('moderations')
      .insert({
        student_id: student.id,
        year_group_id: student.current_year_group_id,
        class_id: student.class_id,
        entity_type: 'student_impacts',
        entity_id: impact.id,
        entity_title: title,
        old_content: null,
        new_content: impact,
        action_type: 'create',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (modErr) throw modErr;

    res.status(201).json({ success: true, message: 'Impact created and submitted for moderation', data: impact });
  } catch (err: any) {
    console.error('Error adding student impact:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete impact
export const deleteStudentImpact = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can delete impacts' });
    }

    const { id } = req.params;

    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });

    // fetch impact row to check if it exists and belongs to student
    const { data: impactRow, error: impactErr } = await supabase
      .from('student_impacts')
      .select('*')
      .eq('id', id)
      .eq('student_id', student.id)
      .single();
      
    if (impactErr || !impactRow) return res.status(404).json({ error: 'Impact not found' });

    // Update impact status to pending_deletion
    const { data: updatedImpact, error: updateErr } = await supabase
      .from('student_impacts')
      .update({ 
        status: 'pending_deletion',
      })
      .eq('id', id)
      .eq('student_id', student.id)
      .select()
      .single();
    
    if (updateErr) throw updateErr;

    // Create moderation record for teacher review
    const { data: moderation, error: modErr } = await supabase
      .from('moderations')
      .insert({
        student_id: student.id,
        year_group_id: student.current_year_group_id,
        class_id: student.class_id,
        entity_type: 'student_impacts',
        entity_id: id,
        entity_title: impactRow.title,
        old_content: impactRow,
        new_content: updatedImpact,
        action_type: 'delete',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (modErr) throw modErr;

    res.status(200).json({ success: true, message: 'Impact deletion submitted for moderation', data: updatedImpact });
  } catch (err: any) {
    console.error('Error deleting student impact:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Fetch my impacts
export const getMyImpacts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can view their impacts' });
    }

    const { year_group_id } = req.body;
    if (!year_group_id) {
      return res.status(400).json({ error: 'Year group ID is required' });
    }

    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });
    
    // return impacts for the student filtered by year_group_id
    const { data, error } = await supabase
      .from('student_impacts')
      .select('id, title, description, attachment_url, status, created_at')
      .eq('student_id', student.id)
      .eq('year_group_id', year_group_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching student impacts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

