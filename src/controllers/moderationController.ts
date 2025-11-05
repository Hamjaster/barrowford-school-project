import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Response } from 'express';
import { logAudit } from '../utils/lib.js';

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
        .eq('auth_user_id', req.user.authUserId)
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
        status,
        profile_photo
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
        status,
        profile_photo
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
    const teacherAuthUserId = req.user.authUserId;

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
        status,
        profile_photo
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

    if (mod.entity_type === 'student_images') {
      if (mod.action_type === 'create') {
        // Update existing student_images record status to 'approved'
        const { data: updated, error: updateErr } = await supabase
          .from('student_images')
          .update({ status: 'approved' })
          .eq('id', mod.entity_id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        applyResult = updated;

        // Log audit for create action
        await logAudit({
          action: 'create',
          entityType: 'student_images',
          entityId: mod.entity_id,
          oldValue: { ...mod.new_content, status: 'pending' },
          newValue: updated,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      } else if (mod.action_type === 'update') {
        const updatePayload = mod.new_content;
        const { data: updated, error: updateErr } = await supabase
          .from('student_images')
          .update(updatePayload)
          .eq('id', mod.entity_id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        applyResult = updated;

        // Log audit for update action
        await logAudit({
          action: 'update',
          entityType: 'student_images',
          entityId: mod.entity_id,
          oldValue: mod.old_content,
          newValue: updated,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      } else if (mod.action_type === 'delete') {
        // Actually delete the record when deletion is approved
        const { error: delErr } = await supabase
          .from('student_images')
          .delete()
          .eq('id', mod.entity_id);

        if (delErr) throw delErr;
        applyResult = { deleted: true };

        // Log audit for delete action
        await logAudit({
          action: 'delete',
          entityType: 'student_images',
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
          .from('reflection_comments')
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
    } else if (mod.entity_type === 'student_learning_entities') {
      if (mod.action_type === 'create') {
        // Update existing learning record status to 'approved'
        const { data: updated, error: updateErr } = await supabase
          .from('student_learning_entities')
          .update({ 
            status: 'approved'
          })
          .eq('id', mod.entity_id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        applyResult = updated;

        // Log audit for create action
        await logAudit({
          action: 'create',
          entityType: 'student_learning_entities',
          entityId: mod.entity_id,
          oldValue: { ...mod.new_content, status: 'pending' },
          newValue: updated,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      } else if (mod.action_type === 'update') {
        const updatePayload = mod.new_content;
        const { data: updated, error: updateErr } = await supabase
          .from('student_learning_entities')
          .update({
            ...updatePayload,
            status: 'approved'
          })
          .eq('id', mod.entity_id)
          .select()
          .single();
        if (updateErr) throw updateErr;
        applyResult = updated;

        // Log audit for update action
        await logAudit({
          action: 'update',
          entityType: 'student_learning_entities',
          entityId: mod.entity_id,
          oldValue: mod.old_content,
          newValue: updated,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      } else if (mod.action_type === 'delete') {
        // Actually delete the record when deletion is approved
        const { error: delErr } = await supabase
          .from('student_learning_entities')
          .delete()
          .eq('id', mod.entity_id);
        if (delErr) throw delErr;
        applyResult = { deleted: true };

        // Log audit for delete action
        await logAudit({
          action: 'delete',
          entityType: 'student_learning_entities',
          entityId: mod.entity_id,
          oldValue: mod.old_content,
          newValue: null,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      }
    } else if (mod.entity_type === 'student_impacts') {
      if (mod.action_type === 'create') {
        // Update existing impact record status to 'approved'
        const { data: updated, error: updateErr } = await supabase
          .from('student_impacts')
          .update({ 
            status: 'approved'
          })
          .eq('id', mod.entity_id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        applyResult = updated;

        // Log audit for create action
        await logAudit({
          action: 'create',
          entityType: 'student_impacts',
          entityId: mod.entity_id,
          oldValue: { ...mod.new_content, status: 'pending' },
          newValue: updated,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      } else if (mod.action_type === 'delete') {
        // Actually delete the record when deletion is approved
        const { error: delErr } = await supabase
          .from('student_impacts')
          .delete()
          .eq('id', mod.entity_id);
        if (delErr) throw delErr;
        applyResult = { deleted: true };

        // Log audit for delete action
        await logAudit({
          action: 'delete',
          entityType: 'student_impacts',
          entityId: mod.entity_id,
          oldValue: mod.old_content,
          newValue: null,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      }
    } else if (mod.entity_type === 'student_experiences') {
      if (mod.action_type === 'create') {
        // Update existing experience record status to 'approved'
        const { data: updated, error: updateErr } = await supabase
          .from('student_experiences')
          .update({ 
            status: 'approved'
          })
          .eq('id', mod.entity_id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        applyResult = updated;

        // Log audit for create action
        await logAudit({
          action: 'create',
          entityType: 'student_experiences',
          entityId: mod.entity_id,
          oldValue: { ...mod.new_content, status: 'pending' },
          newValue: updated,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      } else if (mod.action_type === 'delete') {
        // Actually delete the record when deletion is approved
        const { error: delErr } = await supabase
          .from('student_experiences')
          .delete()
          .eq('id', mod.entity_id);
        if (delErr) throw delErr;
        applyResult = { deleted: true };

        // Log audit for delete action
        await logAudit({
          action: 'delete',
          entityType: 'student_experiences',
          entityId: mod.entity_id,
          oldValue: mod.old_content,
          newValue: null,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      }
    } else if (mod.entity_type === 'personal_sections') {
      if (mod.action_type === 'create') {
        // Update existing personal section status to 'approved'
        const { data: updated, error: updateErr } = await supabase
          .from('personal_sections')
          .update({ 
            status: 'approved'
          })
          .eq('id', mod.entity_id)
          .select()
          .single();

        if (updateErr) throw updateErr;
        applyResult = updated;

        // Log audit for create action
        await logAudit({
          action: 'create',
          entityType: 'personal_sections',
          entityId: mod.entity_id,
          oldValue: { ...mod.new_content, status: 'pending' },
          newValue: updated,
          actorId: mod.student_id,
          actorRole: 'student'
        });
      } else if (mod.action_type === 'update') {
        const updatePayload = mod.new_content;
        const { data: updated, error: updateErr } = await supabase
          .from('personal_sections')
          .update({
            ...updatePayload,
            status: 'approved'
          })
          .eq('id', mod.entity_id)
          .select()
          .single();
        if (updateErr) throw updateErr;
        applyResult = updated;

        // Log audit for update action
        await logAudit({
          action: 'update',
          entityType: 'personal_sections',
          entityId: mod.entity_id,
          oldValue: mod.old_content,
          newValue: updated,
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
    const teacherAuthUserId = req.user.authUserId;
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
        status,
        profile_photo
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

    // Handle student_images rejection by updating status
    if (mod.entity_type === 'student_images') {
      if (mod.action_type === 'create') {
        // Rejecting creation - update status to 'rejected'
        const { error: imageUpdateErr } = await supabase
          .from('student_images')
          .update({ status: 'rejected' })
          .eq('id', mod.entity_id);

        if (imageUpdateErr) throw imageUpdateErr;
      } else if (mod.action_type === 'delete') {
        // Rejecting deletion - revert status back to 'approved'
        const { error: imageUpdateErr } = await supabase
          .from('student_images')
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

    // Handle student_learning_entities rejection by updating status
    if (mod.entity_type === 'student_learning_entities') {
      if (mod.action_type === 'create') {
        // Rejecting creation - update status to 'rejected'
        const { error: learningUpdateErr } = await supabase
          .from('student_learning_entities')
          .update({ 
            status: 'rejected',
          })
          .eq('id', mod.entity_id);

        if (learningUpdateErr) throw learningUpdateErr;
      } else if (mod.action_type === 'delete') {
        // Rejecting deletion - revert status back to 'approved'
        const { error: learningUpdateErr } = await supabase
          .from('student_learning_entities')
          .update({ 
            status: 'approved'
          })
          .eq('id', mod.entity_id);

        if (learningUpdateErr) throw learningUpdateErr;
      }
    }

    // Handle student_impacts rejection by updating status
    if (mod.entity_type === 'student_impacts') {
      if (mod.action_type === 'create') {
        // Rejecting creation - update status to 'rejected'
        const { error: impactUpdateErr } = await supabase
          .from('student_impacts')
          .update({ 
            status: 'rejected',
          })
          .eq('id', mod.entity_id);

        if (impactUpdateErr) throw impactUpdateErr;
      } else if (mod.action_type === 'delete') {
        // Rejecting deletion - revert status back to 'approved'
        const { error: impactUpdateErr } = await supabase
          .from('student_impacts')
          .update({ 
            status: 'approved'
          })
          .eq('id', mod.entity_id);

        if (impactUpdateErr) throw impactUpdateErr;
      }
    }

    // Handle student_experiences rejection by updating status
    if (mod.entity_type === 'student_experiences') {
      if (mod.action_type === 'create') {
        // Rejecting creation - update status to 'rejected'
        const { error: experienceUpdateErr } = await supabase
          .from('student_experiences')
          .update({ 
            status: 'rejected',
          })
          .eq('id', mod.entity_id);

        if (experienceUpdateErr) throw experienceUpdateErr;
      } else if (mod.action_type === 'delete') {
        // Rejecting deletion - revert status back to 'approved'
        const { error: experienceUpdateErr } = await supabase
          .from('student_experiences')
          .update({ 
            status: 'approved'
          })
          .eq('id', mod.entity_id);

        if (experienceUpdateErr) throw experienceUpdateErr;
      }
    }

    // Handle personal_sections rejection by updating status
    if (mod.entity_type === 'personal_sections') {
      if (mod.action_type === 'create') {
        // Rejecting creation - update status to 'rejected'
        const { error: personalSectionUpdateErr } = await supabase
          .from('personal_sections')
          .update({ 
            status: 'rejected'
          })
          .eq('id', mod.entity_id);

        if (personalSectionUpdateErr) throw personalSectionUpdateErr;
      } else if (mod.action_type === 'update') {

        // Rejecting update - revert status back to 'approved'
        const { data: moderation, error: moderationError } = await supabase.from('moderations').select('old_content').eq('id', mod.id).single();
        console.log(moderation, 'moderation ! to reject');
        if (moderationError) throw moderationError;

        const { error: personalSectionUpdateErr } = await supabase
          .from('personal_sections')
          .update({ 
            status: 'approved',
            content: moderation.old_content.content
          })
          .eq('id', mod.entity_id);

        if (personalSectionUpdateErr) throw personalSectionUpdateErr;
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
