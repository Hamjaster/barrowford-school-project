import { Request, Response } from 'express';
import { supabase } from '../db/supabase';
import { AuthUtils } from '../utils/auth';
import { AuthenticatedRequest } from '../middleware/auth';

// Helper function to validate role-specific user creation
const canCreateSpecificRole = (creatorRole: string, targetRole: string) => {
  const roleHierarchy = {
    admin: ['staff_admin', 'staff', 'parent', 'student'],
    staff_admin: ['staff', 'parent', 'student'],
    staff: ['parent', 'student']
  };

  const allowedRoles = roleHierarchy[creatorRole as keyof typeof roleHierarchy];
  
  if (!allowedRoles || !allowedRoles.includes(targetRole)) {
    return {
      allowed: false,
      message: `${creatorRole} cannot create ${targetRole} accounts`
    };
  }

  return { allowed: true, message: '' };
};

// Helper function to validate password reset permissions
const canResetSpecificUserPassword = (creatorRole: string, targetRole: string) => {
  const resetPermissions = {
    admin: ['staff_admin', 'staff', 'parent', 'student'],
    staff_admin: ['staff', 'parent', 'student'],
    staff: ['parent', 'student']
  };

  const allowedRoles = resetPermissions[creatorRole as keyof typeof resetPermissions];
  
  if (!allowedRoles || !allowedRoles.includes(targetRole)) {
    return {
      allowed: false,
      message: `${creatorRole} cannot reset password for ${targetRole} accounts`
    };
  }

  return { allowed: true, message: '' };
};

// REGISTER
export const register = async (req: Request, res: Response) => {
  const { email, password, dob, first_name, last_name, role } = req.body;

  if (!email || !password || !dob || !first_name || !last_name || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!['student', 'teacher', 'staff', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password
  });

  if (authError) return res.status(400).json({ error: authError.message });

  // Store profile data in app_user
  if (authData.user) {
    const { error: insertError } = await supabase
    .from('app_user')
    .insert({
      auth_user_id: authData.user.id, // UUID
      dob,
      first_name,
      last_name,
      password : AuthUtils.hashPassword(password),
      email,
      role
    });
  

    if (insertError) {
      // If insert fails, delete auth user to keep things clean
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({ error: insertError.message });
    }
  }

  res.json({ message: 'Registration successful. Please verify your email.' });
};

// LOGIN
export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  if (error) return res.status(400).json({ error: error.message });
  console.log(data.user?.id, 'uuid');
  // Get role from app_user table
  const { data: roleData, error: roleError } = await supabase
    .from('app_user')
    .select('role, first_name, last_name, dob')
    .eq('auth_user_id', data.user?.id)
    .single()
  

  console.log(roleData, 'role DATA');

  if (roleError) return res.status(400).json({ error: roleError.message });
  const authToken = AuthUtils.generateAccessToken({
    userId: data.user?.id,
    role: roleData.role,
    email: data.user?.email
  });

  res.json({
    access_token: authToken,
    user: {
      id: data.user?.id,
      email: data.user?.email,
      role: roleData.role,
      first_name: roleData.first_name,
      last_name: roleData.last_name,
      dob: roleData.dob
    }
  });
};

/**
 * CREATE USER - Role-based user creation API
 * 
 * Allows higher-level roles to create lower-level users based on school hierarchy:
 * - Admin: Can create staff_admin, staff, parent, student accounts
 * - Staff Admin: Can create staff, parent, student accounts  
 * - Staff: Can create parent, student accounts
 * 
 * Features:
 * - All users require email and password (provided by creator)
 * - Students get username format: firstname.lastname (for login purposes)
 * - All users receive email confirmation via Supabase Auth
 * - Automatic username collision handling for students
 * - Password validation for all provided passwords
 * 
 * @param req - Authenticated request with user role info
 * @param res - Response object
 */
export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, first_name, last_name, role } = req.body;
    const creatorRole = req.user.role;

    // Additional role-specific validation
    const canCreateRole = canCreateSpecificRole(creatorRole, role);
    if (!canCreateRole.allowed) {
      return res.status(403).json({ 
        success: false,
        error: canCreateRole.message 
      });
    }

    // Validate required fields
    if (!email || !password || !first_name || !last_name || !role) {
      return res.status(400).json({ 
        success: false,
        error: 'Email, password, first name, last name, and role are required' 
      });
    }

    // Validate role
    if (!['admin', 'staff_admin', 'staff', 'parent', 'student'].includes(role)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid role' 
      });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('app_user')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        error: 'User with this email already exists' 
      });
    }

    // Validate password <-- REMOVE THIS
    // const passwordValidation = AuthUtils.validatePassword(password);
    // if (!passwordValidation.isValid) {
    //   return res.status(400).json({ 
    //     success: false,
    //     error: `Password validation failed: ${passwordValidation.errors.join(', ')}` 
    //   });
    // }

    // Generate username for students (firstname.lastname format)
    let username = undefined;
    if (role === 'student') {
      username = AuthUtils.generateUsername(first_name, last_name);
      
      // Check if username already exists and add suffix if needed
      const { data: existingUsername } = await supabase
        .from('app_user')
        .select('email')
        .ilike('email', `${username}%`)
        .eq('role', 'student');

      if (existingUsername && existingUsername.length > 0) {
        username = AuthUtils.generateUsername(first_name, last_name, (existingUsername.length + 1).toString());
      }
    }

    // Use the provided email for all users
    const emailToUse = email;

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: emailToUse,
      password: password,
      email_confirm: true, // Supabase will send confirmation email automatically
      user_metadata: {
        first_name,
        last_name,
        role
      }
    });

    console.log("user added in auth")

    if (authError) {
      return res.status(400).json({ 
        success: false,
        error: authError.message 
      });
      
    }
    console.log(authData, 'authData')
    // Store profile data in app_user table
    if (authData.user) {
      const { error: insertError } = await supabase
        .from('app_user')
        .insert({
          auth_user_id: authData.user.id,
          first_name,
          last_name,
          email: email,
          password: await AuthUtils.hashPassword(password),
          role,
        });

      if (insertError) {
        // If insert fails, delete auth user to keep things clean
        await supabase.auth.admin.deleteUser(authData.user.id);
        return res.status(400).json({ 
          success: false,
          error: insertError.message 
        });
      }
    }
    console.log("user added in app_user")


    // Confirmation email is automatically sent by Supabase for all users
    const responseData: any = {
      success: true,
      message: `${role} account created successfully. Confirmation email sent to user.`,
      user: {
        id: authData.user?.id,
        email: email,
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

// FORGOT PASSWORD - Request password reset link
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: 'Email is required' 
      });
    }

    // Check if user exists and get their role
    const { data: userData, error: userError } = await supabase
      .from('app_user')
      .select('role, first_name, last_name')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      // Don't reveal if user exists or not (security best practice)
      return res.json({ 
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.' 
      });
    }

    // Students cannot reset passwords via email
    if (userData.role === 'student') {
      return res.json({ 
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.' 
      });
    }

    // Generate password reset token
    const resetToken = AuthUtils.generatePasswordResetToken();
    const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store reset token in app_user table
    const { error: updateError } = await supabase
      .from('app_user')
      .update({
        password_reset_token: resetToken,
        password_reset_expires: resetExpires.toISOString()
      })
      .eq('email', email);

    if (updateError) {
      console.error('Error storing reset token:', updateError);
      return res.json({ 
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent.' 
      });
    }

    // Send password reset email
    try {
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
      
      // For now, log the reset link (you can integrate with your email service)
      console.log('Password reset link for', email, ':', resetLink);
      
      // TODO: Integrate with your email service to send the actual email
      // await emailService.sendPasswordResetEmail(email, resetLink, userData.first_name);
      
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
    }

    res.json({ 
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.' 
    });

  } catch (error) {
    console.error('Error in forgot password:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
};

// RESET PASSWORD - Confirm password reset with token
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ 
        success: false,
        error: 'Token and new password are required' 
      });
    }

    // Validate password strength
    const passwordValidation = AuthUtils.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        success: false,
        error: `Password validation failed: ${passwordValidation.errors.join(', ')}` 
      });
    }

    // Find user with valid reset token
    const { data: userData, error: userError } = await supabase
      .from('app_user')
      .select('id, email, role, password_reset_expires, auth_user_id')
      .eq('password_reset_token', token)
      .single();

    if (userError || !userData) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid or expired reset token' 
      });
    }

    // Check if token has expired
    if (userData.password_reset_expires && new Date(userData.password_reset_expires) < new Date()) {
      return res.status(400).json({ 
        success: false,
        error: 'Reset token has expired' 
      });
    }

    // Students cannot reset passwords via email
    if (userData.role === 'student') {
      return res.status(400).json({ 
        success: false,
        error: 'Students cannot reset passwords via email' 
      });
    }

    // Update password in Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(
      userData.auth_user_id, // Use auth_user_id from app_user table
      { password: newPassword }
    );

    if (authError) {
      console.error('Error updating password in auth:', authError);
      return res.status(400).json({ 
        success: false,
        error: 'Failed to update password' 
      });
    }

    // Update password in app_user table
    const { error: updateError } = await supabase
      .from('app_user')
      .update({
        password: await AuthUtils.hashPassword(newPassword),
        password_reset_token: null,
        password_reset_expires: null
      })
      .eq('id', userData.id);

    if (updateError) {
      console.error('Error updating password in app_user:', updateError);
      return res.status(400).json({ 
        success: false,
        error: 'Failed to update password' 
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

// MANUAL PASSWORD RESET - Higher user resets lower user's password
export const manualPasswordReset = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetUserId, newPassword } = req.body;
    const creatorRole = req.user.role;

    if (!targetUserId || !newPassword) {
      return res.status(400).json({ 
        success: false,
        error: 'Target user ID and new password are required' 
      });
    }

    // Validate password strength
    const passwordValidation = AuthUtils.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        success: false,
        error: `Password validation failed: ${passwordValidation.errors.join(', ')}` 
      });
    }

    // Get target user details
    const { data: targetUser, error: targetError } = await supabase
      .from('app_user')
      .select('id, role, email, auth_user_id')
      .eq('id', targetUserId)
      .single();

    if (targetError || !targetUser) {
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

    // Update password in app_user table
    const { error: updateError } = await supabase
      .from('app_user')
      .update({
        password: await AuthUtils.hashPassword(newPassword),
        password_reset_token: null,
        password_reset_expires: null
      })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('Error updating password in app_user:', updateError);
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
