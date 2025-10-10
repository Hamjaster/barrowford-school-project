import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/lib.js';
const getStudentRecord = async (userId: string) => {
  return await supabase
    .from('students')
    .select('*')
    .eq('id', userId)
    .single();
};

// FOR MANAGERS (admin, staff, staff_admin)
export const createPersonalSectionTopic = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description } = req.body;
    
    if (!title) return res.status(400).json({ error: 'Title is required' });

    // Build the insert data dynamically
    const insertData: Record<string, any> = { 
      title, 
      status: 'active' 
    };
    if (description?.trim()) {
      insertData.description = description.trim();
    }

    const { data, error } = await supabase
      .from('personal_section_topics')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;
    
    // Log audit for create action
    // userId in JWT is the actual user record ID
    await logAudit({
      action: 'create',
      entityType: 'personal_section_topics',
      entityId: data.id,
      oldValue: null,
      newValue: data,
      actorId: req.user.userId,
      actorRole: req.user.role
    });

    res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error('Error creating personal section topic:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};



export const updatePersonalSectionTopic = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Get old value for audit log
    const { data: oldData, error: oldError } = await supabase
      .from('personal_section_topics')
      .select('*')
      .eq('id', id)
      .single();

    if (oldError) throw oldError;

    // Build update object dynamically
    const updateFields: Record<string, any> = { title };
    if (description !== undefined) {
      updateFields.description = description; // can be empty or updated text
    }

    const { data, error } = await supabase
      .from('personal_section_topics')
      .update(updateFields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log audit for update action
    // userId in JWT is the actual user record ID
    await logAudit({
      action: 'update',
      entityType: 'personal_section_topics',
      entityId: id,
      oldValue: oldData,
      newValue: data,
      actorId: req.user.userId,
      actorRole: req.user.role,
    });

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error updating personal section topic:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deletePersonalSectionTopic = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get old value for audit log
    const { data: oldData, error: oldError } = await supabase
      .from('personal_section_topics')
      .select('*')
      .eq('id', id)
      .single();

    if (oldError) throw oldError;

    const { error } = await supabase
      .from('personal_section_topics')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Log audit for delete action
    // userId in JWT is the actual user record ID
    await logAudit({
      action: 'delete',
      entityType: 'personal_section_topics',
      entityId: id,
      oldValue: oldData,
      newValue: null,
      actorId: req.user.userId,
      actorRole: req.user.role
    });

    res.status(200).json({ success: true, message: 'Topic deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting personal section topic:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const getAllpersonal_section_topics = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('personal_section_topics')
      .select('*')
      .eq('status', 'active') // Only return active topics
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching personal section topics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all personal section topics (including inactive) - for staff management
export const getAllpersonal_section_topicsForManagement = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('personal_section_topics')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching all personal section topics:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Activate personal section topic
export const togglepersonal_section_topicstatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
const {status} = req.body;
    // validate the status that it shall be active or inactive
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get old value for audit log
    const { data: oldData, error: oldError } = await supabase
      .from('personal_section_topics')
      .select('*')
      .eq('id', id)
      .single();

    if (oldError) throw oldError;

    const { data, error } = await supabase
      .from('personal_section_topics')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log audit for status change
    // userId in JWT is the actual user record ID
    await logAudit({
      action: 'update',
      entityType: 'personal_section_topics',
      entityId: id,
      oldValue: oldData,
      newValue: data,
      actorId: req.user.userId,
      actorRole: req.user.role
    });

    res.status(200).json({ success: true, message: 'Topic status toggled successfully', data });
  } catch (err: any) {
    console.error('Error toggling personal section topic status:', err);
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
    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    // Check if personal section already exists for this student and topic
    const { data: existingSection, error: existingError } = await supabase
      .from('personal_sections')
      .select('id')
      .eq('student_id', student.id)
      .eq('topic_id', topic_id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existingSection) {
      return res.status(409).json({ 
        error: 'Personal section already exists for this topic',
        message: 'You have already created a personal section for this topic. Please update the existing one instead.'
      });
    }

    // Create personal section with pending status
    const { data, error } = await supabase
      .from('personal_sections')
      .insert({ 
        student_id: student.id, 
        topic_id, 
        content,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Create moderation record for teacher review
    const { data: moderation, error: modErr } = await supabase
      .from('moderations')
      .insert({
        student_id: student.id,
        year_group_id: student.year_group_id,
        class_id: student.class_id,
        entity_type: 'personal_sections',
        entity_id: data.id,
        entity_title: `Personal Section - Topic ${topic_id}`,
        old_content: null,
        new_content: data,
        action_type: 'create',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (modErr) throw modErr;

    res.status(201).json({ success: true, message: 'Personal section created and submitted for moderation', data });
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
    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    // Get old value for audit log
    const { data: oldData, error: oldError } = await supabase
      .from('personal_sections')
      .select('*')
      .eq('id', id)
      .eq('student_id', student.id)
      .single();

    if (oldError) throw oldError;

    // Update personal section with pending_updation status
    const { data, error } = await supabase
      .from('personal_sections')
      .update({ 
        content,
        status: 'pending_updation',
        
        
      })
      .eq('id', id)
      .eq('student_id', student.id)
      .select()
      .single();

    if (error) throw error;

    // Create moderation record for teacher review
    const { data: moderation, error: modErr } = await supabase
      .from('moderations')
      .insert({
        student_id: student.id,
        year_group_id: student.year_group_id,
        class_id: student.class_id,
        entity_type: 'personal_sections',
        entity_id: id,
        entity_title: `Personal Section Update - Topic ${oldData.topic_id}`,
        old_content: oldData,
        new_content: data,
        action_type: 'update',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();


    
    if (modErr) throw modErr;
      
      //update that personal section and pass moderation_id to it
      const { error: updateErr } = await supabase
        .from('personal_sections')
        .update({ moderation_id: moderation.id })
        .eq('id', id)
        .eq('student_id', student.id);
        
      if (updateErr) throw updateErr;

    res.status(200).json({ success: true, message: 'Personal section update submitted for moderation', data });
  } catch (err: any) {
    console.error('Error updating personal section:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
export const getStudentpersonal_sections = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    // Verify the student exists
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, first_name, last_name')
      .eq('id', studentId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get the student's personal sections
    const { data, error } = await supabase
      .from('personal_sections')
      .select(`
        id,
        content,
        status,
        created_at,
      
        topic:personal_section_topics (id, title)
      `)
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching student personal sections:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePersonalSectionByTeacher = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Verify the personal section exists
    const { data: existingSection, error: existingError } = await supabase
      .from('personal_sections')
      .select('id, student_id, content')
      .eq('id', id)
      .single();

    if (existingError || !existingSection) {
      return res.status(404).json({ error: 'Personal section not found' });
    }

    // Update the personal section content
    const { data, error } = await supabase
      .from('personal_sections')
      .update({ content})
      .eq('id', id)
      .select(`
        id,
        content,
        created_at,
        topic:personal_section_topics (id, title)
      `)
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error updating personal section:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMypersonal_sections = async (req: AuthenticatedRequest, res: Response) => {
  try {
 

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id')
      .eq('auth_user_id', req.user.authUserId)
      .single();

    if (studentError || !student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    const { data, error } = await supabase
      .from('personal_sections')
      .select(`
        id,
        content,
        status,
        created_at,
        topic:personal_section_topics (id, title)
      `)
      .eq('student_id', student.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching personal sections:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get my personal section for a specific topic
export const getMyPersonalSectionByTopic = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { topicId } = req.params;

    if (!topicId) {
      return res.status(400).json({ error: 'Topic ID is required' });
    }

    // Find student record
    const {data : student} = await getStudentRecord(req.user.userId);
    if (!student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    // Fetch student's personal section for this topic
    console.log(student, topicId, 'TOPICS', 'student')
    const { data, error } = await supabase
      .from('personal_sections')
      .select(`
        id,
        content,
        status,
        created_at,
       
        topic:personal_section_topics (id, title)
      `)
      .eq('student_id', student.id)
      .eq('topic_id', topicId)
      .maybeSingle(); // maybeSingle: returns null if no match, avoids throwing error

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching personal section by topic:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
