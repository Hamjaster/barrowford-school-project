import { Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/lib.js';

// helper: fetch student record
const getStudentRecord = async (userId: string) => {
  return await supabase
    .from('students')
    .select('id, year_group_id')
    .eq('id', userId)
    .single();
};

// update "impacts"
export const updateImpact = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });

    // find page_type_id for impacts
    const { data: pageType, error: pageTypeError } = await supabase
      .from('page_types')
      .select('id')
      .eq('name', 'impacts')
      .single();

    if (pageTypeError || !pageType) return res.status(400).json({ error: 'PageType impacts not found' });

    // Check if record exists by student_id, year_group_id, and page_type_id
    const { data: existingRecord, error: findError } = await supabase
      .from('student_pages')
      .select('*')
      .eq('student_id', student.id)
      .eq('year_group_id', student.year_group_id)
      .eq('page_type_id', pageType.id)
      .single();

    let data;
    let isCreate = false;

    if (findError && findError.code === 'PGRST116') {
      // Record doesn't exist, create new one
      const { data: newRecord, error: createError } = await supabase
        .from('student_pages')
        .insert({
          student_id: student.id,
          year_group_id: student.year_group_id,
          page_type_id: pageType.id,
          content
        })
        .select()
        .single();

      if (createError) throw createError;
      data = newRecord;
      isCreate = true;
    } else if (findError) {
      // Some other error occurred
      throw findError;
    } else {
      // Record exists, update it
      const { data: updatedRecord, error: updateError } = await supabase
        .from('student_pages')
        .update({
          content
        })
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (updateError) throw updateError;
      data = updatedRecord;
      isCreate = false;
    }

    // userId in JWT is the actual user record ID

    // Log audit
    await logAudit({
      action: isCreate ? 'create' : 'update',
      entityType: 'student_pages',
      entityId: data.id,
      oldValue: isCreate ? null : existingRecord,
      newValue: data,
      actorId: req.user.userId,
      actorRole: req.user.role
    });

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error updating impact:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// update "experiences"
export const updateExperience = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });

    // find page_type_id for experiences
    const { data: pageType, error: pageTypeError } = await supabase
      .from('page_types')
      .select('id')
      .eq('name', 'experiences')
      .single();

    if (pageTypeError || !pageType) return res.status(400).json({ error: 'PageType experiences not found' });

    // Check if record exists by student_id, year_group_id, and page_type_id
    const { data: existingRecord, error: findError } = await supabase
      .from('student_pages')
      .select('*')
      .eq('student_id', student.id)
      .eq('year_group_id', student.year_group_id)
      .eq('page_type_id', pageType.id)
      .single();

    let data;
    let isCreate = false;

    if (findError && findError.code === 'PGRST116') {
      // Record doesn't exist, create new one
      const { data: newRecord, error: createError } = await supabase
        .from('student_pages')
        .insert({
          student_id: student.id,
          year_group_id: student.year_group_id,
          page_type_id: pageType.id,
          content
        })
        .select()
        .single();

      if (createError) throw createError;
      data = newRecord;
      isCreate = true;
    } else if (findError) {
      // Some other error occurred
      throw findError;
    } else {
      // Record exists, update it
      const { data: updatedRecord, error: updateError } = await supabase
        .from('student_pages')
        .update({
          content
        })
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (updateError) throw updateError;
      data = updatedRecord;
      isCreate = false;
    }

    // userId in JWT is the actual user record ID

    // Log audit
    await logAudit({
      action: isCreate ? 'create' : 'update',
      entityType: 'student_pages',
      entityId: data.id,
      oldValue: isCreate ? null : existingRecord,
      newValue: data,
      actorId: req.user.userId,
      actorRole: req.user.role
    });

    res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Error updating experience:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// fetch my impacts
export const getMyImpacts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });
    
    // find page_type_id for impacts
    const { data: pageType, error: pageTypeError } = await supabase
      .from('page_types')
      .select('id')
      .eq('name', 'impacts')
      .single();

    if (pageTypeError || !pageType) return res.status(400).json({ error: 'PageType Impacts not found' });

    const { data, error } = await supabase
      .from('student_pages')
      .select('id, content, created_at')
      .eq('student_id', student.id)
      .eq('year_group_id', student.year_group_id)
      .eq('page_type_id', pageType.id)
      .single();

    if (error && error.code === 'PGRST116') {
      const dummyContent = {"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Start typing here..."}]}]}
      // No record found, create a new one with empty content
      const { data: newRecord, error: createError } = await supabase
      .from('student_pages')
      .insert({
        student_id: student.id,
        year_group_id: student.year_group_id,
        page_type_id: pageType.id,
        // wrap in back ticks
        content: `{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Start typing here..."}]}]}`
      })
      .select('id, content, created_at')
      .single();
      console.log('no found so creating a new one', newRecord, createError);
    
      if (createError) throw createError;

     
      // Log audit for the creation
      await logAudit({
        action: 'create',
        entityType: 'student_pages',
        entityId: newRecord.id,
        oldValue: null,
        newValue: newRecord,
        actorId: req.user.userId,
        actorRole: req.user.role
      });

      res.status(200).json({ success: true, data: newRecord });
    } else if (error) {
      throw error;
    } else {
      res.status(200).json({ success: true, data });
    }
  } catch (err: any) {
    console.error('Error fetching impacts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// fetch my experiences
export const getMyExperiences = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data: student, error: studentError } = await getStudentRecord(req.user.userId);
    if (studentError || !student) return res.status(404).json({ error: 'Student not found' });
    
    // find page_type_id for experiences
    const { data: pageType, error: pageTypeError } = await supabase
      .from('page_types')
      .select('id')
      .eq('name', 'experiences')
      .single();

    if (pageTypeError || !pageType) return res.status(400).json({ error: 'PageType experiences not found' });

    const { data, error } = await supabase
      .from('student_pages')
      .select('id, content, created_at')
      .eq('student_id', student.id)
      .eq('year_group_id', student.year_group_id)
      .eq('page_type_id', pageType.id)
      .single();

    if (error && error.code === 'PGRST116') {
      // No record found, create a new one with empty content
      const { data: newRecord, error: createError } = await supabase
        .from('student_pages')
        .insert({
          student_id: student.id,
          year_group_id: student.year_group_id,
          page_type_id: pageType.id,
          content: `{"type":"doc","content":[{"type":"paragraph","attrs":{"textAlign":null},"content":[{"type":"text","text":"Start typing here..."}]}]}`
        })
        .select('id, content, created_at')
        .single();

      if (createError) throw createError;


      // Log audit for the creation
      await logAudit({
        action: 'create',
        entityType: 'student_pages',
        entityId: newRecord.id,
        oldValue: null,
        newValue: newRecord,
        actorId: req.user.userId,
        actorRole: req.user.role
      });

      res.status(200).json({ success: true, data: newRecord });
    } else if (error) {
      throw error;
    } else {
      res.status(200).json({ success: true, data });
    }
  } catch (err: any) {
    console.error('Error fetching experiences:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
