import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// FOR MANAGERS (admin, staff, staff_admin)
export const createPersonalSectionTopic = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const { data, error } = await supabase
      .from('personalsectiontopics')
      .insert({ title })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error('Error creating personal section topic:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const updatePersonalSectionTopic = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    const { data, error } = await supabase
      .from('personalsectiontopics')
      .update({ title })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Error updating personal section topic:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const deletePersonalSectionTopic = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('personalsectiontopics')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Topic deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting personal section topic:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const getAllPersonalSectionTopics = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('personalsectiontopics')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching personal section topics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ONLY FOR STUDENTS
export const createPersonalSection = async (req: AuthenticatedRequest, res: Response) => {
  try {


    const { topic_id, content } = req.body;
    if (!topic_id || !content) {
      return res.status(400).json({ error: 'Topic ID and content are required' });
    }

    // Find student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('auth_user_id', req.user.userId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    const { data, error } = await supabase
      .from('personalsections')
      .insert({ student_id: student.id, topic_id, content })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error('Error creating personal section:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const updatePersonalSection = async (req: AuthenticatedRequest, res: Response) => {
  try {
  

    const { id } = req.params;
    const { content } = req.body;

    // Find student record
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('auth_user_id', req.user.userId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    const { data, error } = await supabase
      .from('personalsections')
      .update({ content })
      .eq('id', id)
      .eq('student_id', student.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Error updating personal section:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const getMyPersonalSections = async (req: AuthenticatedRequest, res: Response) => {
  try {
 

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('auth_user_id', req.user.userId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    const { data, error } = await supabase
      .from('personalsections')
      .select(`
        id,
        content,
        created_at,
        topic:personalsectiontopics (id, title)
      `)
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching personal sections:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};