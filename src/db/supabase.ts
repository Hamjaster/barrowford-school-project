import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

// Admin client for operations requiring elevated privileges (auth.admin operations, bulk imports)
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

// Regular client for user-context operations (default for most operations)
export const supabaseClient = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

// Default export uses client (anon key) for most operations
// Import supabaseAdmin only for auth.admin operations and bulk imports
export const supabase = supabaseAdmin;
// export const supabase = supabaseClient; Remove this line when you want to use the client for most operations
