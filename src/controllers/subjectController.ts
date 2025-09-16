import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit, findUserByAuthUserId } from '../utils/lib.js';

// FOR MANAGERS (admin, staff, staff_admin)
export const createSubject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const { data, error } = await supabase
      .from('subjects')
      .insert({ name, description, status: 'active' })
      .select()
      .single();

    if (error) throw error;
    
    // Get actual user ID for audit log
    const user = await findUserByAuthUserId(req.user.userId);
    if (!user) throw new Error('User not found');
    
    // Log audit for create action
    await logAudit({
      action: 'create',
      entityType: 'subjects',
      entityId: data.id,
      oldValue: null,
      newValue: data,
      actorId: user.id,
      actorRole: req.user.role
    });

    res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error('Error creating subject:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSubject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Get old value for audit log
    const { data: oldData, error: oldError } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();

    if (oldError) throw oldError;

    const { data, error } = await supabase
      .from('subjects')
      .update({ name, description })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Get actual user ID for audit log
    const user = await findUserByAuthUserId(req.user.userId);
    if (!user) throw new Error('User not found');

    // Log audit for update action
    await logAudit({
      action: 'update',
      entityType: 'subjects',
      entityId: id,
      oldValue: oldData,
      newValue: data,
      actorId: user.id,
      actorRole: req.user.role
    });

    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Error updating subject:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteSubject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Get old value for audit log
    const { data: oldData, error: oldError } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();

    if (oldError) throw oldError;

    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Get actual user ID for audit log
    const user = await findUserByAuthUserId(req.user.userId);
    if (!user) throw new Error('User not found');

    // Log audit for delete action
    await logAudit({
      action: 'delete',
      entityType: 'subjects',
      entityId: id,
      oldValue: oldData,
      newValue: null,
      actorId: user.id,
      actorRole: req.user.role
    });

    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting subject:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllSubjects = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('status', 'active') // Only return active subjects
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Error fetching subjects:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// Activate subject
export const toggleSubjectStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
const {status} = req.body;
    // validate the status that it shall be active or inactive
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get old value for audit log
    const { data: oldData, error: oldError } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', id)
      .single();

    if (oldError) throw oldError;

    const { data, error } = await supabase
      .from('subjects')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Get actual user ID for audit log
    const user = await findUserByAuthUserId(req.user.userId);
    if (!user) throw new Error('User not found');

    // Log audit for status change
    await logAudit({
      action: 'update',
      entityType: 'subjects',
      entityId: id,
      oldValue: oldData,
      newValue: data,
      actorId: user.id,
      actorRole: req.user.role
    });

    res.json({ success: true, message: 'Subject status toggled successfully', data });
  } catch (err: any) {
    console.error('Error toggling subject status:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
