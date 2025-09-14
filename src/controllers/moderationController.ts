import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Response } from 'express';

// List pending moderations (with optional filters: entity_type, student_id)
export const listPendingModerations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { student_id } = req.body;
    
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
      *
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    // Filter by student_id if provided
    if (student_id) q = q.eq('student_id', student_id);
    
    // Filter by teacher's year_group_id and class_id if user is a teacher
    if (req.user.role === 'staff' && teacherYearGroupId && teacherClassId) {
      q = q.eq('year_group_id', teacherYearGroupId).eq('class_id', teacherClassId);
    }

    const { data, error } = await q;

    if (error) throw error;
    res.json({ success: true, data });
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
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
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

    // fetch moderation
    const { data: mod, error: modErr } = await supabase
      .from('moderations')
      .select('*')
      .eq('id', modId)
      .single();

    if (modErr || !mod) return res.status(404).json({ success: false, error: 'Moderation not found' });
    if (mod.status !== 'pending') return res.status(400).json({ success: false, error: 'Moderation not pending' });

    // apply action based on entity_type and action_type
    let applyResult = null;

    if (mod.entity_type === 'studentimages') {
      if (mod.action_type === 'create') {
        // insert into studentimages using new_content
        const insertPayload = mod.new_content; // expect { student_id, year_group_id, image_url }
        const { data: inserted, error: insertErr } = await supabase
          .from('studentimages')
          .insert(insertPayload)
          .select()
          .single();

        if (insertErr) throw insertErr;
        applyResult = inserted;
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
      } else if (mod.action_type === 'delete') {
        const { error: delErr } = await supabase
          .from('studentimages')
          .delete()
          .eq('id', mod.entity_id);

        if (delErr) throw delErr;
        applyResult = { deleted: true };
      }
    } else if (mod.entity_type === 'reflection') {
        // REFLECTIONS ARE NOT DEVELOPED YET
    //   if (mod.action_type === 'create') {
    //     const insertPayload = mod.new_content; // must be { student_id, year_group_id, topic_id, content, attachment_url }
    //     const { data: inserted, error: insertErr } = await supabase
    //       .from('reflections')
    //       .insert(insertPayload)
    //       .select()
    //       .single();
    //     if (insertErr) throw insertErr;
    //     applyResult = inserted;
    //   } else if (mod.action_type === 'update') {
    //     const updatePayload = mod.new_content;
    //     const { data: updated, error: updateErr } = await supabase
    //       .from('reflections')
    //       .update(updatePayload)
    //       .eq('id', mod.entity_id)
    //       .select()
    //       .single();
    //     if (updateErr) throw updateErr;
    //     applyResult = updated;
    //   } else if (mod.action_type === 'delete') {
    //     const { error: delErr } = await supabase
    //       .from('reflections')
    //       .delete()
    //       .eq('id', mod.entity_id);
    //     if (delErr) throw delErr;
    //     applyResult = { deleted: true };
    //   }
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
      } else if (mod.action_type === 'delete') {
        const { error: delErr } = await supabase
          .from('studentlearningentities')
          .delete()
          .eq('id', mod.entity_id);
        if (delErr) throw delErr;
        applyResult = { deleted: true };
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


    res.json({ success: true, data: applyResult });
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

    const { data: mod, error: modErr } = await supabase
      .from('moderations')
      .select('*')
      .eq('id', modId)
      .single();

    if (modErr || !mod) return res.status(404).json({ success: false, error: 'Moderation not found' });
    if (mod.status !== 'pending') return res.status(400).json({ success: false, error: 'Moderation not pending' });

    const { error: modUpdateErr } = await supabase
      .from('moderations')
      .update({
        status: 'rejected',
        moderated_at: new Date().toISOString(),
        rejection_reason: reason || null
      })
      .eq('id', modId);

    if (modUpdateErr) throw modUpdateErr;

    res.json({ success: true, message: 'Moderation rejected' });
  } catch (err) {
    console.error('rejectModeration error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
