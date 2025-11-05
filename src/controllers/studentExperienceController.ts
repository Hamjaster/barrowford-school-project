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

// Add new experience (student only)
export const addStudentExperience = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can add experiences' });
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
    
    // Create experience record with pending status
    const { data: experience, error: experienceErr } = await supabase
      .from('student_experiences')
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
    
    if (experienceErr) throw experienceErr;

    // Create moderation record for teacher review
    const { data: moderation, error: modErr } = await supabase
      .from('moderations')
      .insert({
        student_id: student.id,
        year_group_id: student.current_year_group_id,
        class_id: student.class_id,
        entity_type: 'student_experiences',
        entity_id: experience.id,
        entity_title: title,
        old_content: null,
        new_content: experience,
        action_type: 'create',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (modErr) throw modErr;

    res.status(201).json({ success: true, message: 'Experience created and submitted for moderation', data: experience });
  } catch (err: any) {
    console.error('Error adding student experience:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete experience
export const deleteStudentExperience = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can delete experiences' });
    }

    const { id } = req.params;

    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });

    // fetch experience row to check if it exists and belongs to student
    const { data: experienceRow, error: experienceErr } = await supabase
      .from('student_experiences')
      .select('*')
      .eq('id', id)
      .eq('student_id', student.id)
      .single();
      
    if (experienceErr || !experienceRow) return res.status(404).json({ error: 'Experience not found' });

    // Update experience status to pending_deletion
    const { data: updatedExperience, error: updateErr } = await supabase
      .from('student_experiences')
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
        entity_type: 'student_experiences',
        entity_id: id,
        entity_title: experienceRow.title,
        old_content: experienceRow,
        new_content: updatedExperience,
        action_type: 'delete',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (modErr) throw modErr;

    res.status(200).json({ success: true, message: 'Experience deletion submitted for moderation', data: updatedExperience });
  } catch (err: any) {
    console.error('Error deleting student experience:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Fetch my experiences
export const getMyExperiences = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can view their experiences' });
    }

    const { year_group_id } = req.body;
    if (!year_group_id) {
      return res.status(400).json({ error: 'Year group ID is required' });
    }

    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });
    
    // return experiences for the student filtered by year_group_id
    const { data, error } = await supabase
      .from('student_experiences')
      .select('id, title, description, attachment_url, status, created_at')
      .eq('student_id', student.id)
      .eq('year_group_id', year_group_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching student experiences:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

