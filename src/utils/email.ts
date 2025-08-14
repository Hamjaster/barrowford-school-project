import nodemailer from 'nodemailer';
import { config } from '../config';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: false,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string, userName: string): Promise<void> {
    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: config.email.from,
      to: email,
      subject: 'Password Reset - School Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello ${userName},</p>
          <p>You have requested to reset your password for your School Portal account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
          <p><strong>This link will expire in ${config.passwordReset.tokenExpiryHours} hour(s).</strong></p>
          <p>If you did not request this password reset, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated email from School Portal. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendWelcomeEmail(email: string, userName: string, temporaryPassword: string, role: string): Promise<void> {
    const loginUrl = `${config.frontendUrl}/login`;
    
    const mailOptions = {
      from: config.email.from,
      to: email,
      subject: 'Welcome to School Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to School Portal</h2>
          <p>Hello ${userName},</p>
          <p>Your account has been created successfully. Here are your login details:</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> <code style="background-color: #e9ecef; padding: 2px 4px; border-radius: 3px;">${temporaryPassword}</code></p>
            <p><strong>Role:</strong> ${role}</p>
          </div>
          <p><strong style="color: #dc3545;">Please change your password after your first login for security purposes.</strong></p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Login to School Portal
            </a>
          </div>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated email from School Portal. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async sendChildAccountCreatedEmail(parentEmail: string, childName: string, username: string, temporaryPassword: string): Promise<void> {
    const loginUrl = `${config.frontendUrl}/login`;
    
    const mailOptions = {
      from: config.email.from,
      to: parentEmail,
      subject: 'Child Account Created - School Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Child Account Created</h2>
          <p>Dear Parent/Guardian,</p>
          <p>An account has been created for your child <strong>${childName}</strong> on the School Portal.</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Child's Name:</strong> ${childName}</p>
            <p><strong>Username:</strong> <code style="background-color: #e9ecef; padding: 2px 4px; border-radius: 3px;">${username}</code></p>
            <p><strong>Temporary Password:</strong> <code style="background-color: #e9ecef; padding: 2px 4px; border-radius: 3px;">${temporaryPassword}</code></p>
          </div>
          <p><strong style="color: #dc3545;">Please help your child change their password after the first login for security purposes.</strong></p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" 
               style="background-color: #17a2b8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Access School Portal
            </a>
          </div>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated email from School Portal. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    await this.transporter.sendMail(mailOptions);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}
