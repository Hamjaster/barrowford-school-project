import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthUtils } from '../utils/auth.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { sendUserCreationEmail } from '../utils/resend.js';
import { canManageRole, getRoleTable, isValidRole, UserRole } from '../utils/roleUtils.js';
import { logAudit, findUserByAuthUserId } from '../utils/lib.js';

// Helper function to validate role-specific user creation
const canCreateSpecificRole = (creatorRole: string, targetRole: string) => {
  return canManageRole(creatorRole as UserRole, targetRole as UserRole);
};

// Helper function to validate password reset permissions
const canResetSpecificUserPassword = (creatorRole: string, targetRole: string) => {
  return canManageRole(creatorRole as UserRole, targetRole as UserRole);
};

// Helper function to create role-specific table entries
const createRoleSpecificEntry = async (role: string, additionalData: any = {}) => {
  try {
    const table = getRoleTable(role as UserRole);

    switch (role) {
      case 'admin':
        const { data: adminData, error: adminError } = await supabase
          .from(table)
          .insert({
            auth_user_id: additionalData.auth_user_id,
            first_name: additionalData.first_name,
            last_name: additionalData.last_name,
            email: additionalData.email,

          })
          .select()
          .single();
        if (adminError) throw adminError;
        return adminData;

      case 'staff_admin':
        const { data: staffAdminData, error: staffAdminError } = await supabase
          .from(table)
          .insert({
            auth_user_id: additionalData.auth_user_id,
            first_name: additionalData.first_name,
            last_name: additionalData.last_name,
            email: additionalData.email,
          })
          .select()
          .single();
        if (staffAdminError) throw staffAdminError;
        return staffAdminData;
      case 'staff':
        const { data: staffData, error: teacherError } = await supabase
          .from(table)
          .insert({
            auth_user_id: additionalData.auth_user_id,
            year_group_id: additionalData.year_group_id || null,
            class_id: additionalData.class_id || null,
            email: additionalData.email,
            first_name: additionalData.first_name,
            last_name: additionalData.last_name,
          })
          .select()
          .single();
        if (teacherError) throw teacherError;
        return staffData;

      case 'parent':
        const { error: parentError, data: parentData } = await supabase
          .from(table)
          .insert({
            auth_user_id: additionalData.auth_user_id,
            first_name: additionalData.first_name,
            last_name: additionalData.last_name,
            email: additionalData.email,
          })
          .select()
          .single();
        console.log("Parent error", parentError);
        console.log("Parent data", parentData);
        if (parentError) throw parentError;
        return parentData;

      case 'student':
        const { data: studentData, error: studentError } = await supabase
          .from(table)
          .insert({
            auth_user_id: additionalData.auth_user_id,
            year_group_id: additionalData.year_group_id || null,
            class_id: additionalData.class_id || null,
            username: additionalData.username,
            email: additionalData.email,
            first_name: additionalData.first_name,
            last_name: additionalData.last_name,
            profile_photo: additionalData.profile_photo
          })
          .select()
          .single();
        if (studentError) throw studentError;

        // Create parent-student relationship if parent_id is provided
        if (additionalData.parent_ids[0]) {
          const relationships = additionalData.parent_ids.map((pid: number) => ({
            parent_id: pid,
            student_id: studentData.id
          }));

          const { error: relError } = await supabase
            .from('parent_student_relationships')
            .insert(relationships);

          if (relError) throw relError;
        }
        return studentData;

      default:
        // No additional table entry needed for other roles
        break;
    }
  } catch (error) {
    console.error(`Error creating ${role} entry:`, error);
    throw error;
  }
};



export const login = async (req: Request, res: Response) => {
  const { email, username, password } = req.body;

  if ((!email && !username) || !password) {
    return res.status(400).json({ error: 'Email/username and password are required' });
  }

  let emailToUse = email;

  if (username && !email) {
    // Only students use username
    emailToUse = username + '@school.com';
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailToUse!,
    password
  });

  if (error) return res.status(400).json({ error: 'Invalid email/username or password' });

  // Fetch user role/profile
  console.log("Finding user by email", emailToUse);
  const userProfile = await AuthUtils.findUserByEmail(emailToUse!);
  if (!userProfile) {
    return res.status(404).json({ error: 'User profile not found' });
  }

  // Check if user is active
  if (userProfile.status && userProfile.status !== 'active') {
    return res.status(403).json({
      success: false,
      error: 'Account is inactive. Please contact an administrator.'
    });
  }

  const authToken = AuthUtils.generateAccessToken({
    userId: data.user?.id,
    role: userProfile.role,
    email: userProfile.email
  });

  const response: any = {
    access_token: authToken,
    user: {
      id: data.user?.id,
      email: userProfile.email,
      role: userProfile.role,
      first_name: userProfile.first_name,
      last_name: userProfile.last_name,
      dob: userProfile.dob
    },
    session: data.session
  };

  if (userProfile.role === 'student') {
    response.user.username = AuthUtils.generateUsername(userProfile.first_name, userProfile.last_name);
  }

  res.status(200).json(response);
};

export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      email, // for non-students
      username, // for students only
      password,
      first_name,
      last_name,
      role,
      parent_ids, // an array of parent ids
      year_group_id,
      class_id,
      profile_photo
    } = req.body;

    const creatorRole = req.user.role;
    let emailToUse = email;

    if (role === 'student' && !email) {

      emailToUse = username + '@school.com';
    }


    // Validate role
    if (!isValidRole(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      });
    }
    // Additional role-specific validation
    const canCreateRole = canCreateSpecificRole(creatorRole, role);
    if (!canCreateRole.allowed) {
      4
      return res.status(403).json({
        success: false,
        error: canCreateRole.message
      });
    }

    // Validate required fields
    if (!emailToUse || !password || !first_name || !last_name || !role) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, first name, last name, and role are required'
      });
    }


    // Students must have at least one parent
    let parentDataList: any[] = [];
    if (role === 'student') {
      if (!parent_ids || !Array.isArray(parent_ids) || parent_ids.length === 0) {
        return res.status(400).json({ error: 'At least one parent ID is required for student accounts' });
      }
      // Verify parents exist
      const { data: fetchedParents, error: parentsError } = await supabase
        .from('parents')
        .select('id, email, first_name, last_name')
        .in('id', parent_ids);

      if (parentsError || !fetchedParents || fetchedParents.length !== parent_ids.length) {
        return res.status(400).json({ error: 'One or more parent IDs are invalid' });
      }

      parentDataList = fetchedParents;
    }

    // Check if user already exists across all role tables
    const emailChecks = await Promise.all([
      supabase.from('admins').select('email').eq('email', emailToUse).single(),
      supabase.from('staff_admins').select('email').eq('email', emailToUse).single(),
      supabase.from('staffs').select('email').eq('email', emailToUse).single(),
      supabase.from('parents').select('email').eq('email', emailToUse).single(),
      supabase.from('students').select('email').eq('email', emailToUse).single(),
    ]);

    const existingUser = emailChecks.find(check => check.data && !check.error);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }
    console.log("EMAIL TO USE", emailToUse);
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: emailToUse,
      password: password,
      email_confirm: true, // Create user with auto-confirmation
      user_metadata: {
        first_name,
        last_name,
        role
      }
    });
    console.log("User created in auth", authData);

    if (authError) {
      return res.status(400).json({
        success: false,
        error: authError.message
      });
    }

    // Create user directly in role-specific table
    if (authData.user) {
      try {
        const userData: Record<string, any> = {
          first_name,
          last_name,
          email: emailToUse,
          auth_user_id: authData.user.id,
          year_group_id,
          class_id,
          parent_ids,
          username,
        };
        if (profile_photo) {
          userData.profile_photo = profile_photo;
        }
        console.log("User data", userData);

        const createdUser = await createRoleSpecificEntry(role, userData);
        console.log(`${role} entry created successfully`, createdUser);

        // Get actual user ID for audit log
        const user = await findUserByAuthUserId(req.user.userId);
        if (!user) throw new Error('User not found');

        // Log audit for user creation
        await logAudit({
          action: 'create',
          entityType: getRoleTable(role as UserRole),
          entityId: createdUser.id,
          oldValue: null,
          newValue: createdUser,
          actorId: user.id,
          actorRole: req.user.role
        });

      } catch (roleError) {
        console.error(`Failed to create ${role} entry:`, roleError);
        // If role-specific creation fails, clean up auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
        return res.status(400).json({
          success: false,
          error: `Failed to create ${role} profile: ${roleError}`
        });
      }
    }

    // Send welcome email to the newly created user
    try {
      // For students, send email to parent; for others, send to their own email
      let emailRecipient = emailToUse;
      let recipientName = `${first_name} ${last_name}`;

      if (role === 'student' && parentDataList.length > 0) {
        emailRecipient = parentDataList[0].email;
        recipientName = `${parentDataList[0].first_name} ${parentDataList[0].last_name}`;
      }

      await sendUserCreationEmail(
        emailRecipient,
        first_name,
        last_name,
        role,
        password,
        username, // Only provided for students
        role === 'student' ? parentDataList : null // Pass parent data for students
      );
      console.log(`Welcome email sent successfully to ${emailRecipient} ${role === 'student' ? '(parent)' : ''}`);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail user creation if email fails, but log it
      // The user is created successfully, email is just a bonus
    }

    const formatRole = (role: string) => {
      return role
        .split('_') // Split by underscore
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize each word
        .join(' '); // Join with space
    };

    // Prepare response
    const emailRecipientForMessage = role === 'student' && parentDataList.length > 0 ? parentDataList[0].email : emailToUse;
    const emailRecipientNote = role === 'student' && parentDataList.length > 0 ? ' (sent to parent)' : '';

    const responseData: any = {
      success: true,
      message: `${formatRole(role)} account created successfully. Welcome email sent to ${emailRecipientForMessage}${emailRecipientNote}.`,
      user: {
        id: authData.user?.id,
        email: emailToUse,
        role,
        first_name,
        last_name,
        created_by: req.user.userId
      }
    };

    // Include username for students (they login with username but have real email)
    if (role === 'student') {
      responseData.user.username = username;
      responseData.message += ` Student will login using username: ${username}`;
    }

    res.status(201).json(responseData);

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};


export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = await AuthUtils.findUserByEmail(email);
  if (!user) {
    return res.status(200).json({ success: true, message: 'A reset link has been sent to that email address' });
  }

  if (user.role === 'student') {
    return res.status(400).json({
      success: false,
      message: 'Students cannot reset passwords via email. Contact an admin/teacher.'
    });
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL}/reset-password`
  });

  if (error) return res.status(400).json({ success: false, message: 'Failed to send reset email' });

  res.status(200).json({ success: true, message: 'Password reset email sent' });
};

// RESET PASSWORD - Update password using Supabase Auth (called from frontend after email link click)
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { accessToken, refreshToken, newPassword } = req.body;

    if (!accessToken || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Access token and new password are required'
      });
    }

    // Create a Supabase client and set the session from the tokens
    const userSupabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // Set the session using the tokens from the password reset URL
    const { data: sessionData, error: sessionError } = await userSupabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    console.log('Session set result:', sessionData, sessionError);

    if (sessionError || !sessionData.session) {
      console.error('Error setting session:', sessionError);
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset tokens'
      });
    }

    const { user } = sessionData;
    console.log('User from session:', user);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session'
      });
    }

    // Check if user exists in our app_user table and get their role
    const userData = await AuthUtils.findUserByAuthUserId(user.id);

    if (!userData) {
      return res.status(404).json({
        success: false,
        error: 'User not found in system'
      });
    }

    // Students cannot reset passwords via email
    if (userData.role === 'student') {
      return res.status(403).json({
        success: false,
        error: 'Students cannot reset passwords via email'
      });
    }

    console.log("CREATED CLIENT !", userSupabase);
    console.log('GOT SESSION !');
    // Update the password using the authenticated session
    const { error: updateError } = await userSupabase.auth.updateUser({
      password: newPassword
    });
    console.log('UPDATED PASSWORD !');

    if (updateError) {
      console.error('Error updating password:', updateError);
      return res.status(400).json({
        success: false,
        error: updateError.message || 'Failed to update password'
      });
    }

    res.json({ 
      success: true,
      message: 'Password has been reset successfully'
    });

  } catch (error) {
    console.error('Error in reset password:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// MANUAL PASSWORD RESET - Higher user resets lower user's password by email
export const manualPasswordReset = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, newPassword } = req.body;
    const creatorRole = req.user.role;

    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email and new password are required'
      });
    }

    // Get target user details by email
    const targetUser = await AuthUtils.findUserByEmail(email);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Target user not found'
      });
    }

    // Check if creator can reset this user's password
    const canResetPassword = canResetSpecificUserPassword(creatorRole, targetUser.role);
    if (!canResetPassword.allowed) {
      return res.status(403).json({
        success: false,
        error: canResetPassword.message
      });
    }

    console.log('updating password in auth');
    // Update password in Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(
      targetUser.auth_user_id,
      { password: newPassword }
    );

    if (authError) {
      console.error('Error updating password in auth:', authError);
      return res.status(400).json({
        success: false,
        error: 'Failed to update password'
      });
    }

    res.json({ 
      success: true,
      message: `Password for ${targetUser.email} has been reset successfully`
    });

  } catch (error) {
    console.error('Error in manual password reset:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};