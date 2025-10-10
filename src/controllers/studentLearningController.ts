import { Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getTeacherRecordFromClass } from '../utils/lib.js';

// helper to fetch student
const getStudentRecord = async (userId: string) => {
  return await supabase
    .from('students')
    .select('*')
    .eq('id', userId)
    .single();
};

  // Add new learning (student only)
export const addStudentLearning = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Only students can add learnings' });
      }

      const { subject_id, title, content, attachment_url } = req.body;
      if (!subject_id || (!content && !attachment_url)) {
        return res.status(400).json({ error: 'Subject and either content or attachment is required' });
      }

      // find student
      const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
      if (studentError || !student) return res.status(404).json({ error: 'Student not found' });
      
      // Create learning record with pending status
      const { data: learning, error: learningErr } = await supabase
        .from('student_learning_entities')
        .insert({
          student_id: student.id,
          subject_id: subject_id,
          title,
          description: content,
          attachment_url,
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (learningErr) throw learningErr;

      // Create moderation record for teacher review
      const { data: moderation, error: modErr } = await supabase
        .from('moderations')
        .insert({
          student_id: student.id,
          year_group_id: student.year_group_id,
          class_id: student.class_id,
          entity_type: 'student_learning_entities',
          entity_id: learning.id,
          entity_title: title,
          old_content: null,
          new_content: learning,
          action_type: 'create',
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (modErr) throw modErr;

      res.status(201).json({ success: true, message: 'Learning created and submitted for moderation', data: learning });
    } catch (err: any) {
      console.error('Error adding student learning:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Delete learning
export const deleteStudentLearning = async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Only students can delete learnings' });
      }

      const { id } = req.params;

      const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
      if (studentError || !student) return res.status(404).json({ error: 'Student not found' });

      // fetch learning row to check if it exists and belongs to student
      const { data: learningRow, error: learningErr } = await supabase
        .from('student_learning_entities')
        .select('*')
        .eq('id', id)
        .eq('student_id', student.id)
        .single();
        
      if (learningErr || !learningRow) return res.status(404).json({ error: 'Learning not found' });

      // Update learning status to pending_deletion
      const { data: updatedLearning, error: updateErr } = await supabase
        .from('student_learning_entities')
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
          year_group_id: student.year_group_id,
          class_id: student.class_id,
          entity_type: 'student_learning_entities',
          entity_id: id,
          entity_title: learningRow.title,
          old_content: learningRow,
          new_content: updatedLearning,
          action_type: 'delete',
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (modErr) throw modErr;

      res.status(200).json({ success: true, message: 'Learning deletion submitted for moderation', data: updatedLearning });
    } catch (err: any) {
      console.error('Error deleting student learning:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

// Fetch my learnings
export const getMyLearnings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {subject_id} = req.body
    if (req.user.role  !== 'student') {
      return res.status(403).json({ error: 'Only students can view their learnings' });
    }

    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });
    
    // only return learnings for the subject_id if provided
    const { data, error } = await supabase
      .from('student_learning_entities')
      .select('id, subject_id, title, description, attachment_url, status, created_at')
      .eq('student_id', student.id)
      .eq('subject_id', subject_id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching student learnings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
