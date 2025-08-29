import { Request, Response } from 'express';
import { supabase } from '../db/supabase.js';
import { AuthUtils } from '../utils/auth.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { sendUserCreationEmail } from '../utils/resend.js';

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

// Helper function to convert student username to email
const findStudentEmailByUsername = async (username: string): Promise<string | null> => {
  try {
    console.log('Looking up email for username:', username);
    
    // Look up all students to find matching username
    const { data: userData, error: userError } = await supabase
      .from('app_user')
      .select('email, role, first_name, last_name')
      .eq('role', 'student');

    if (userError) {
      console.error('Error looking up username:', userError);
      return null;
    }

    if (!userData || userData.length === 0) {
      return null;
    }

    // Find the student whose generated username matches the provided username
    const matchedUser = userData.find(user => {
      // Generate the expected username for this student
      const expectedUsername = AuthUtils.generateUsername(user.first_name, user.last_name);
      
      // Also check for username with suffix (in case of duplicates)
      // The suffix would be a number appended to the base username
      const baseUsername = `${user.first_name.toLowerCase().trim()}.${user.last_name.toLowerCase().trim()}`;
      
      return expectedUsername === username || 
             username.startsWith(baseUsername) || 
             expectedUsername === username.toLowerCase();
    });

    if (!matchedUser) {
      return null;
    }

    console.log('Converted username to email:', matchedUser.email);
    return matchedUser.email;
    
  } catch (error) {
    console.error('Error in findStudentEmailByUsername:', error);
    return null;
  }
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

/**
 * LOGIN - Universal login endpoint supporting both email and username authentication
 * 
 * Features:
 * - Staff/Admin/Parents: Login with email + password
 * - Students: Login with username + password (username format: firstname.lastname)
 * - Automatic username-to-email conversion for student authentication
 * - Handles username collisions (with numeric suffixes)
 * - Returns JWT token with role-based permissions
 * - Includes username in response for student accounts
 * 
 * @param req.body.email - Email address (for non-student users)
 * @param req.body.username - Username (for student users, format: firstname.lastname)
 * @param req.body.password - User password
 * @returns JWT access token and user profile information
 */
export const login = async (req: Request, res: Response) => {
  const { email, username, password } = req.body;

  // Validate input - either email or username must be provided
  if ((!email && !username) || !password) {
    return res.status(400).json({ 
      error: 'Email/username and password are required' 
    });
  }

  // If both email and username are provided, prioritize email
  if (email && username) {
    return res.status(400).json({ 
      error: 'Please provide either email or username, not both' 
    });
  }

  let emailToUse = email;

  // If username is provided, convert it to email (for students)
  if (username && !email) {
    emailToUse = await findStudentEmailByUsername(username);
    
    if (!emailToUse) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }
  }

  // Authenticate with Supabase using email
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailToUse!,
    password
  });
  
  if (error) {
    console.error('Authentication error:', error);
    return res.status(400).json({ error: 'Invalid email/username or password' });
  }

  console.log(data.user?.id, 'uuid');
  
  // Get role and profile data from app_user table
  const { data: roleData, error: roleError } = await supabase
    .from('app_user')
    .select('role, first_name, last_name, dob, email')
    .eq('auth_user_id', data.user?.id)
    .single();

  console.log(roleData, 'role DATA');

  if (roleError) {
    console.error('Error fetching user role:', roleError);
    return res.status(400).json({ error: 'User profile not found' });
  }

  // Generate JWT token
  const authToken = AuthUtils.generateAccessToken({
    userId: data.user?.id,
    role: roleData.role,
    email: data.user?.email
  });

  // Prepare response data
  const responseData: any = {
    access_token: authToken,
    user: {
      id: data.user?.id,
      email: data.user?.email,
      role: roleData.role,
      first_name: roleData.first_name,
      last_name: roleData.last_name,
      dob: roleData.dob
    }
  };

  // Add username for students
  if (roleData.role === 'student') {
    const studentUsername = AuthUtils.generateUsername(roleData.first_name, roleData.last_name);
    responseData.user.username = studentUsername;
  }

  res.json(responseData);
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
    const { email, password, first_name, last_name, role, parent_id } = req.body;
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

    // Validate parent_id for students
    if (role === 'student') {
      if (!parent_id) {
        return res.status(400).json({ 
          success: false,
          error: 'Parent ID is required for student accounts' 
        });
      }

      // Verify parent exists and has 'parent' role
      const { data: parentData, error: parentError } = await supabase
        .from('app_user')
        .select('id, role')
        .eq('id', parent_id)
        .eq('role', 'parent')
        .single();

      if (parentError || !parentData) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid parent ID or parent not found' 
        });
      }
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

    // Create user in Supabase Auth - create unconfirmed user first
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
    console.log("user created in auth", authData)
    

    if (authError) {
      return res.status(400).json({ 
        success: false,
        error: authError.message 
      });
    }

    console.log(authData, 'authData')
    // Store profile data in app_user table
    if (authData.user) {
      const insertData: any = {
        auth_user_id: authData.user.id,
        first_name,
        last_name,
        email: email,
        password: await AuthUtils.hashPassword(password),
        role,
      };

      // Add parent_id for students
      if (role === 'student' && parent_id) {
        // insertData.parent_id = parent_id; // REMOVE THIS when we have a proper DB
      }

      const { error: insertError } = await supabase
        .from('app_user')
        .insert(insertData);

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

    // Send welcome email to the newly created user
    try {
      await sendUserCreationEmail(
        email,
        first_name,
        last_name,
        role,
        password,
        username // Only provided for students
      );
      console.log(`Welcome email sent successfully to ${email}`);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail user creation if email fails, but log it
      // The user is created successfully, email is just a bonus
    }

    // Confirmation email has been sent manually via generateLink
    const responseData: any = {
      success: true,
      message: `${role} account created successfully. Welcome email sent to ${email}.`,
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

// FORGOT PASSWORD - Request password reset link using Supabase Auth
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: 'Email is required' 
      });
    }

    // Check if user exists in our app_user table and get their role
    const { data: userData, error: userError } = await supabase
      .from('app_user')
      .select('role, first_name, last_name')
      .eq('email', email)
      .single();

    // If user doesn't exist in our system, don't reveal this information
    if (userError || !userData) {
      return res.status(400).json({ 
        success: false,
        message: 'There was an error sending the password reset email. ' 
      });
    }

    // Students cannot reset passwords via email (they need admin/staff to reset)
    if (userData.role === 'student') {
      return res.status(400).json({ 
        success: true,
        message: 'Students cannot reset passwords via email. Contact an admin or teacher to reset your password.' 
      });
    }

    // Use Supabase's built-in password reset functionality
    const { data, error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`
    });
    console.log(data,'after sending supabase EMAIL')

    if (resetError) {
      console.error('Error sending password reset email:', resetError);
      // if the resetError contains "is invalid" then return a message that the email is invalid
      if (resetError.message.includes('is invalid')) {
        return res.status(400).json({ 
          success: false,
          message: 'Invalid email address' 
        });
      }
      
      return res.status(400).json({ 
        success: false,
        message: 'There was an error sending the password reset email. ' 
      });
    }

    console.log('Password reset email sent for:', email);

    res.status(200).json({ 
      success: true,
      message: 'If an account with this email exists, a password reset link has been sent.' 
    });

  } catch (error) {
    console.error('Error in forgot password:', error);
    res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

// RESET PASSWORD - Update password using Supabase Auth (called from frontend after email link click)
// This endpoint is used by the frontend when user clicks reset link and wants to set new password
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
    const { data: userData, error: appUserError } = await supabase
      .from('app_user')
      .select('role, email')
      .eq('auth_user_id', user.id)
      .single();

    if (appUserError || !userData) {
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

    console.log("CREATED CLIENT !", userSupabase)
    console.log('GOT SESSION !')
    // Update the password using the authenticated session
    const { error: updateError } = await userSupabase.auth.updateUser({
      password: newPassword
    });
    console.log('UPDATED PASSWORD !')
    
    if (updateError) {
      console.error('Error updating password:', updateError);
      return res.status(400).json({ 
        success: false,
        error: updateError.message || 'Failed to update password' 
      });
    }

    // Update password in app_user table as well for consistency
    const { error: appUserUpdateError } = await supabase
      .from('app_user')
      .update({
        password: await AuthUtils.hashPassword(newPassword)
      })
      .eq('auth_user_id', user.id);

    if (appUserUpdateError) {
      console.error('Error updating password in app_user:', appUserUpdateError);
      // Don't fail the request if this fails, as the auth password was updated successfully
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

    // Validate password strength <-- REMOVE THIS
    // const passwordValidation = AuthUtils.validatePassword(newPassword);
    // if (!passwordValidation.isValid) {
    //   return res.status(400).json({ 
    //     success: false,
    //     error: `Password validation failed: ${passwordValidation.errors.join(', ')}` 
    //   });
    // }

    // Get target user details by email
    const { data: targetUser, error: targetError } = await supabase
      .from('app_user')
      .select('id, role, email, auth_user_id')
      .eq('email', email)
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
console.log('updating password in auth')    // Update password in Supabase Auth
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
      .eq('id', targetUser.id);

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
