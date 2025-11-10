import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { UserRole } from '../types.js';
import { supabase } from '../db/supabase.js';

export interface JWTPayload {
  email?: string | undefined;
  role: UserRole;
  authUserId: string;
  userId: string;
  // iat?: number; // Uncomment this when adding expiry to tokens
  // exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
}

export class AuthUtils {
  static generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as SignOptions);
  }

  static verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  static generateUsername(firstName: string, lastName: string, suffix?: string): string {
    const baseUsername = `${firstName.toLowerCase().trim()}.${lastName.toLowerCase().trim()}`;
    return suffix ? `${baseUsername}${suffix}` : baseUsername;
  }

  static async findUserByAuthUserId(authUserId: string) {
    // Run through all role tables, and find the user by auth_user_id
    const roleTables = [
      { role: 'admin', table: 'admins' },
      { role: 'staff_admin', table: 'staff_admins' },
      { role: 'staff', table: 'staffs' },
      { role: 'parent', table: 'parents' },
      { role: 'student', table: 'students' }
    ];

    for (const { role, table } of roleTables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('auth_user_id', authUserId)
        .single();

      if (!error && data) {
        return { ...data, role, table };
      }
    }
    
    return null;
  }
  
  static async findUserByEmail (email: string) {
    const roleTables = [
      { role: 'admin', table: 'admins' },
      { role: 'staff_admin', table: 'staff_admins' },
      { role: 'staff', table: 'staffs' },
      { role: 'parent', table: 'parents' },
      { role: 'student', table: 'students' }
    ];
  console.log('check for email', email)
    for (const { role, table } of roleTables) {
  
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('email', email)
        .single();
     
      if (!error && data) {
        console.log("Data found", data);
        return { ...data, role, table };
      }
    }
  
    return null;
  };
}
