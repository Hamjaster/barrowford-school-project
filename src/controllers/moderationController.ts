import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Response } from 'express';
import { logAudit, findUserByAuthUserId } from '../utils/lib.js';

// List pending moderations (with optional filters: entity_type, student_id)
export const listPendingModerations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    
    // Get teacher's year_group_id and class_id if the user is a teacher
    let teacherYearGroupId = null;
    let teacherClassId = null;
    
    if (req.user.role === 'staff') {
      const { data: teacher, error: teacherError } = await supabase
        .from('staffs')
        .select('year_group_id, class_id')
        .eq('auth_user_id', req.user.userId)
        .single();

      if (teacherError || !teacher) {
        return res.status(404).json({ success: false, error: 'Teacher record not found' });
      }

      teacherYearGroupId = teacher.year_group_id;
      teacherClassId = teacher.class_id;
    }

    let q = supabase
      .from('moderations')
      .select(`
      *,
      student:students!moderations_student_id_fkey (
        id,
        first_name,
        last_name,
        status
      )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

   
    // Filter by teacher's year_group_id and class_id if user is a teacher
    if (req.user.role === 'staff' && teacherYearGroupId && teacherClassId) {
      q = q.eq('year_group_id', teacherYearGroupId).eq('class_id', teacherClassId);
    }

    const { data, error } = await q;

    if (error) throw error;
    
    // Filter out moderations from inactive students
    const activeModerations = data?.filter(moderation => {
      // If student data is available, check if student is active
      if (moderation.student) {
        return !moderation.student.status || moderation.student.status === 'active';
      }
      // If no student data, include the moderation (fallback)
      return true;
    }) || [];

    res.status(200).json({ success: true, data: activeModerations });
  } catch (err) {
    console.error('listPendingModerations error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getModerationById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('moderations')
      .select(`
      *,
      student:students!moderations_student_id_fkey (
        id,
        first_name,
        last_name,
        status
      )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    
    // Check if the moderation is from an active student
    if (data.student && data.student.status && data.student.status !== 'active') {
      return res.status(404).json({ 
        success: false, 
        error: 'Moderation not found or student is inactive' 
      });
    }
    
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('getModerationById error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Approve moderation
export const approveModeration = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacherAuthUserId = req.user.userId;

    // find teacher record (teacher id)
    const { data: teacherRow, error: teacherErr } = await supabase
      .from('staffs')
      .select('id')
      .eq('auth_user_id', teacherAuthUserId)
      .single();

    if (teacherErr || !teacherRow) {
      return res.status(403).json({ success: false, error: 'Teacher record not found' });
    }

    const teacher_id = teacherRow.id;
    const modId = req.params.id;

    // fetch moderation with student info
    const { data: mod, error: modErr } = await supabase
      .from('moderations')
      .select(`
      *,
      student:students!moderations_student_id_fkey (
        id,
        first_name,
        last_name,
        status
      )
      `)
      .eq('id', modId)
      .single();

    if (modErr || !mod) return res.status(404).json({ success: false, error: 'Moderation not found' });
    if (mod.status !== 'pending') return res.status(400).json({ success: false, error: 'Moderation not pending' });
    
    // Check if the moderation is from an active student
    if (mod.student && mod.student.status && mod.student.status !== 'active') {
      return res.status(404).json({ 
        success: false, 
        error: 'Cannot approve moderation from inactive student' 
      });
    }

    // apply action based on entity_type and action_type
    let applyResult = null;

    if (mod.entity_type === 'studentimages') {
      if (mod.action_type === 'create') {
        // Update existing studentimages record status to 'approved'
        const { data: updated, error: updateErr } = await supabase
          .from('studentimages')
          .update({ status: 'approved' })
          .eq('id', mod.entity_id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        applyResult = updated;

        // Log audit for create action
        await logAudit({
          action: 'create',
          entityType: 'studentimages',
          entityId: mod.entity_id,
          oldValue: { ...mod.new_content, status: 'pending' },
          newValue: updated,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      } else if (mod.action_type === 'update') {
        const updatePayload = mod.new_content;
        const { data: updated, error: updateErr } = await supabase
          .from('studentimages')
          .update(updatePayload)
          .eq('id', mod.entity_id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        applyResult = updated;

        // Log audit for update action
        await logAudit({
          action: 'update',
          entityType: 'studentimages',
          entityId: mod.entity_id,
          oldValue: mod.old_content,
          newValue: updated,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      } else if (mod.action_type === 'delete') {
        // Actually delete the record when deletion is approved
        const { error: delErr } = await supabase
          .from('studentimages')
          .delete()
          .eq('id', mod.entity_id);

        if (delErr) throw delErr;
        applyResult = { deleted: true };

        // Log audit for delete action
        await logAudit({
          action: 'delete',
          entityType: 'studentimages',
          entityId: mod.entity_id,
          oldValue: mod.old_content,
          newValue: null,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      }
    } else if (mod.entity_type === 'reflection') {
      if (mod.action_type === 'create') {
        // Update existing reflection status to 'approved'
        const { data: updated, error: updateErr } = await supabase
          .from('reflections')
          .update({ status: 'approved' })
          .eq('id', mod.entity_id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        applyResult = updated;

        // Log audit for create action
        await logAudit({
          action: 'create',
          entityType: 'reflections',
          entityId: mod.entity_id,
          oldValue: { ...mod.new_content, status: 'pending' },
          newValue: updated,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      } else if (mod.action_type === 'update') {
        const updatePayload = mod.new_content;
        const { data: updated, error: updateErr } = await supabase
          .from('reflections')
          .update(updatePayload)
          .eq('id', mod.entity_id)
          .select()
          .single();
        if (updateErr) throw updateErr;
        applyResult = updated;

        // Log audit for update action
        await logAudit({
          action: 'update',
          entityType: 'reflections',
          entityId: mod.entity_id,
          oldValue: mod.old_content,
          newValue: updated,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      } else if (mod.action_type === 'delete') {
        // Delete all comments associated with this reflection first
        const { error: deleteCommentsError } = await supabase
          .from('reflectioncomments')
          .delete()
          .eq('reflection_id', mod.entity_id);

        if (deleteCommentsError) {
          throw deleteCommentsError;
        }

        // Delete the reflection itself
        const { error: delErr } = await supabase
          .from('reflections')
          .delete()
          .eq('id', mod.entity_id);
        if (delErr) throw delErr;
        applyResult = { deleted: true };

        // Log audit for delete action
        await logAudit({
          action: 'delete',
          entityType: 'reflections',
          entityId: mod.entity_id,
          oldValue: mod.old_content,
          newValue: null,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      }
    } else if (mod.entity_type === 'studentlearningentities') {
      // map to studentlearningentities
      if (mod.action_type === 'create') {
        const insertPayload = mod.new_content;
        const { data: inserted, error: insertErr } = await supabase
          .from('studentlearningentities')
          .insert(insertPayload)
          .select()
          .single();
        if (insertErr) throw insertErr;
        applyResult = inserted;

        // Log audit for create action
        await logAudit({
          action: 'create',
          entityType: 'studentlearningentities',
          entityId: inserted.id,
          oldValue: null,
          newValue: inserted,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      } else if (mod.action_type === 'delete') {
        const { error: delErr } = await supabase
          .from('studentlearningentities')
          .delete()
          .eq('id', mod.entity_id);
        if (delErr) throw delErr;
        applyResult = { deleted: true };

        // Log audit for delete action
        await logAudit({
          action: 'delete',
          entityType: 'studentlearningentities',
          entityId: mod.entity_id,
          oldValue: mod.old_content,
          newValue: null,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      }

    } else {
      return res.status(400).json({ success: false, error: 'Unsupported entity_type' });
    }

    // Update moderation to approved, set teacher id and moderated_at
    const updateModeration = {
      status: 'approved',
      moderated_at: new Date().toISOString(),
      entity_id: mod.entity_id || (applyResult && applyResult.id ? applyResult.id : mod.entity_id)
    };

    const { error: modUpdateErr } = await supabase
      .from('moderations')
      .update(updateModeration)
      .eq('id', modId);

    if (modUpdateErr) throw modUpdateErr;


    res.status(200).json({ success: true, data: applyResult });
  } catch (err) {
    console.error('approveModeration error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Reject moderation
export const rejectModeration = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const teacherAuthUserId = req.user.userId;
    const { data: teacherRow } = await supabase
      .from('staffs')
      .select('id')
      .eq('auth_user_id', teacherAuthUserId)
      .single();

    if (!teacherRow) return res.status(403).json({ success: false, error: 'Teacher record not found' });
    const modId = req.params.id;
    const { reason } = req.body;
   
    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Rejection reason is required.",
      });
    }
    const { data: mod, error: modErr } = await supabase
      .from('moderations')
      .select(`
      *,
      student:students!moderations_student_id_fkey (
        id,
        first_name,
        last_name,
        status
      )
      `)
      .eq('id', modId)
      .single();

    if (modErr || !mod) return res.status(404).json({ success: false, error: 'Moderation not found' });
    if (mod.status !== 'pending') return res.status(400).json({ success: false, error: 'Moderation not pending' });
    
    // Check if the moderation is from an active student
    if (mod.student && mod.student.status && mod.student.status !== 'active') {
      return res.status(404).json({ 
        success: false, 
        error: 'Cannot reject moderation from inactive student' 
      });
    }

    // Handle studentimages rejection by updating status
    if (mod.entity_type === 'studentimages') {
      if (mod.action_type === 'create') {
        // Rejecting creation - update status to 'rejected'
        const { error: imageUpdateErr } = await supabase
          .from('studentimages')
          .update({ status: 'rejected' })
          .eq('id', mod.entity_id);

        if (imageUpdateErr) throw imageUpdateErr;
      } else if (mod.action_type === 'delete') {
        // Rejecting deletion - revert status back to 'approved'
        const { error: imageUpdateErr } = await supabase
          .from('studentimages')
          .update({ status: 'approved' })
          .eq('id', mod.entity_id);

        if (imageUpdateErr) throw imageUpdateErr;
      }
    }

    // Handle reflection rejection by updating status
    if (mod.entity_type === 'reflection') {
      if (mod.action_type === 'create') {
        // Rejecting creation - update status to 'rejected'
        const { error: reflectionUpdateErr } = await supabase
          .from('reflections')
          .update({ status: 'rejected' })
          .eq('id', mod.entity_id);

        if (reflectionUpdateErr) throw reflectionUpdateErr;
      } else if (mod.action_type === 'delete') {
        // Rejecting deletion - revert status back to 'approved'
        const { error: reflectionUpdateErr } = await supabase
          .from('reflections')
          .update({ status: 'approved' })
          .eq('id', mod.entity_id);

        if (reflectionUpdateErr) throw reflectionUpdateErr;
      }
    }

    const { error: modUpdateErr } = await supabase
      .from('moderations')
      .update({
        status: 'rejected',
        moderated_at: new Date().toISOString(),
        rejection_reason: reason || null
      })
      .eq('id', modId);

    if (modUpdateErr) throw modUpdateErr;

    res.status(200).json({ success: true, message: 'Moderation rejected' });
  } catch (err) {
    console.error('rejectModeration error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
