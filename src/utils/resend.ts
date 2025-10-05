import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API);

export const sendEmail = async (to: string, subject: string, html: string) => {
  const { data, error } = await resend.emails.send({
    from: 'Nybble <onboarding@resend.dev>',
    to: [to],
    subject: subject,
    html: html,
  });

  if (error) {
    console.error('Email sending error:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  console.log('Email sent successfully:', data);
  return data;
};

// Email template for user creation confirmation
export const generateUserCreationEmail = (
  firstName: string,
  lastName: string,
  role: string,
  email: string,
  password: string,
  username?: string,
  parentData?: any
): string => {
  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const fullName = `${firstName} ${lastName}`;
  const loginCredential = username || email;
  
  // If this is a student email being sent to parent
  const isStudentEmailToParent = role === 'student' && parentData;
  const recipientName = isStudentEmailToParent ? `${parentData.first_name} ${parentData.last_name}` : fullName;
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Barrowford School</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">
                    🎓 ${isStudentEmailToParent ? 'Student Account Created' : 'Welcome to Barrowford School'}
                </h1>
                <p style="color: #e2e8f0; margin: 10px 0 0 0; font-size: 16px;">
                    ${isStudentEmailToParent ? `A student account has been created for ${fullName}` : 'Your account has been created successfully!'}
                </p>
            </div>
            
            <!-- Main Content -->
            <div style="padding: 40px 30px;">
                <div style="text-align: center; margin-bottom: 30px;">
                    <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                        <span style="color: white; font-size: 36px;">👋</span>
                    </div>
                    <h2 style="color: #1a202c; margin: 0; font-size: 24px; font-weight: 600;">
                        Hello ${recipientName}!
                    </h2>
                    <p style="color: #4a5568; margin: 10px 0 0 0; font-size: 16px;">
                        ${isStudentEmailToParent 
                          ? `A student account has been created for your child <strong style="color: #667eea;">${fullName}</strong>` 
                          : `Welcome to our school community as a <strong style="color: #667eea; text-transform: capitalize;">${role}</strong>`}
                    </p>
                </div>

                <!-- Credentials Box -->
                <div style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border: 2px solid #e2e8f0; border-radius: 12px; padding: 25px; margin: 30px 0;">
                    <h3 style="color: #2d3748; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; text-align: center;">
                        🔐 ${isStudentEmailToParent ? `${fullName}'s Login Credentials` : 'Your Login Credentials'}
                    </h3>
                    <div style="background: #ffffff; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                        <div style="margin-bottom: 15px;">
                            <label style="color: #4a5568; font-size: 14px; font-weight: 500; display: block; margin-bottom: 5px;">
                                ${username ? 'Username' : 'Email'}:
                            </label>
                            <div style="background: #f7fafc; padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                                <code style="color: #2d3748; font-size: 16px; font-weight: 600;">${loginCredential}</code>
                            </div>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="color: #4a5568; font-size: 14px; font-weight: 500; display: block; margin-bottom: 5px;">
                                Temporary Password:
                            </label>
                            <div style="background: #fef5e7; padding: 10px 12px; border-radius: 6px; border: 1px solid #f6e05e;">
                                <code style="color: #744210; font-size: 16px; font-weight: 600;">${password}</code>
                            </div>
                        </div>
                        ${email !== loginCredential ? `
                        <div style="margin-bottom: 15px;">
                            <label style="color: #4a5568; font-size: 14px; font-weight: 500; display: block; margin-bottom: 5px;">
                                Email Address:
                            </label>
                            <div style="background: #f7fafc; padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                                <code style="color: #2d3748; font-size: 16px;">${email}</code>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Security Notice -->
                <div style="background: #fef5e7; border: 1px solid #f6e05e; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <span style="font-size: 20px; margin-right: 10px;">🔒</span>
                        <h4 style="color: #744210; margin: 0; font-size: 16px; font-weight: 600;">
                            Important Security Notice
                        </h4>
                    </div>
                    <p style="color: #744210; margin: 0; font-size: 14px; line-height: 1.5;">
                        Please change your password immediately after your first login for security purposes. 
                        Keep your login credentials safe and do not share them with anyone.
                    </p>
                </div>

                <!-- Login Button -->
                <div style="text-align: center; margin: 35px 0;">
                    <a href="${loginUrl}/login" 
                       style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                              color: #ffffff; 
                              text-decoration: none; 
                              padding: 16px 32px; 
                              border-radius: 8px; 
                              font-size: 16px; 
                              font-weight: 600; 
                              display: inline-block;
                              box-shadow: 0 4px 6px rgba(102, 126, 234, 0.25);
                              transition: all 0.2s ease;">
                        🚀 Login to Your Account
                    </a>
                </div>

                <!-- Additional Info for Students -->
                ${role === 'student' ? `
                <div style="background: #e6fffa; border: 1px solid #81e6d9; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <span style="font-size: 20px; margin-right: 10px;">📚</span>
                        <h4 style="color: #234e52; margin: 0; font-size: 16px; font-weight: 600;">
                            Student Login Information
                        </h4>
                    </div>
                    <p style="color: #234e52; margin: 0; font-size: 14px; line-height: 1.5;">
                        ${isStudentEmailToParent 
                          ? `Your child will use the username <strong>${username}</strong> to log in to their student account. Please keep these credentials safe and share them with your child when appropriate.`
                          : `As a student, you'll use your username <strong>${username}</strong> to log in.`}
                    </p>
                </div>
                ` : ''}

                <!-- Next Steps -->
                <div style="margin: 30px 0;">
                    <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">
                        📋 What's Next?
                    </h3>
                    <ul style="color: #4a5568; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                        ${isStudentEmailToParent ? `
                        <li style="margin-bottom: 8px;">Share the login credentials with your child</li>
                        <li style="margin-bottom: 8px;">Help your child log in using their username: <strong>${username}</strong></li>
                        <li style="margin-bottom: 8px;">Ensure your child changes their temporary password after first login</li>
                        <li style="margin-bottom: 8px;">Monitor your child's learning progress through the parent portal</li>
                        <li style="margin-bottom: 8px;">Contact school staff if you need assistance</li>
                        ` : `
                        <li style="margin-bottom: 8px;">Click the login button above to access your account</li>
                        <li style="margin-bottom: 8px;">Change your temporary password to something secure</li>
                        <li style="margin-bottom: 8px;">Complete your profile information</li>
                        <li style="margin-bottom: 8px;">Explore the platform and its features</li>
                        ${role === 'student' ? '<li style="margin-bottom: 8px;">Start engaging with your learning materials</li>' : ''}
                        ${role === 'parent' ? '<li style="margin-bottom: 8px;">View your child\'s progress and activities</li>' : ''}
                        ${role === 'staff' ? '<li style="margin-bottom: 8px;">Access your teaching dashboard and tools</li>' : ''}
                        `}
                    </ul>
                </div>
            </div>

            <!-- Footer -->
            <div style="background: #f7fafc; border-top: 1px solid #e2e8f0; padding: 25px 30px; text-align: center;">
                <p style="color: #718096; margin: 0 0 10px 0; font-size: 14px;">
                    Need help? Contact our support team or visit our help center.
                </p>
                <p style="color: #a0aec0; margin: 0; font-size: 12px;">
                    This is an automated email from Barrowford School Portal. 
                    Please do not reply to this email.
                </p>
                <div style="margin-top: 15px;">
                    <p style="color: #a0aec0; margin: 0; font-size: 12px;">
                        © ${new Date().getFullYear()} Barrowford School. All rights reserved.
                    </p>
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Send user creation confirmation email
export const sendUserCreationEmail = async (
  email: string,
  firstName: string,
  lastName: string,
  role: string,
  password: string,
  username?: string,
  parentData?: any
) => {
  const subject = role === 'student' && parentData 
        ? `🎓 Student Account Created for ${firstName} ${lastName} - Barrowford School`
    : `🎓 Welcome to Barrowford School - Your Account is Ready!`;
  const html = generateUserCreationEmail(firstName, lastName, role, email, password, username, parentData);
  
  return await sendEmail(email, subject, html);
};
