import * as dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT !),
  nodeEnv: process.env.NODE_ENV ,
  
  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET ,
    expiresIn: process.env.JWT_EXPIRES_IN ,
    refreshSecret: process.env.JWT_REFRESH_SECRET ,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ,
  },
  
  // Email
  email: {
    host: process.env.SMTP_HOST ,
    port: parseInt(process.env.SMTP_PORT!),
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
    from: process.env.EMAIL_FROM ,
  },
  
  // URLs
  frontendUrl: process.env.FRONTEND_URL ,
  
  
  // Password reset
  passwordReset: {
    tokenExpiryHours: 1,
  },
};

// Validate required environment variables
const requiredEnvVars = [
 
  'JWT_SECRET',
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}
