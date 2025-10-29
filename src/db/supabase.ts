import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// Validate service role key is present (critical for production)
if (!config.supabase.serviceRoleKey || config.supabase.serviceRoleKey.trim() === '') {
  console.error('⚠️  WARNING: SUPABASE_SERVICE_ROLE_KEY is missing or empty!');
  console.error('⚠️  Backend queries will fail with RLS enabled.');
}

// Admin client for operations requiring elevated privileges (auth.admin operations, bulk imports)
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

// Regular client for user-context operations (NOT USED - kept for reference)
export const supabaseClient = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

// Default export uses admin client (service role key) to bypass RLS
// Backend handles authentication via custom JWT middleware, so all queries should bypass RLS
// RLS policies are meant for direct client-side access, not backend API queries
export const supabase = supabaseAdmin;
