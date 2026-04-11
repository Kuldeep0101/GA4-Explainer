import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side actions (bypasses RLS)
// We only initialize this if we are on the server to prevent frontend crashes
export const supabaseAdmin = typeof window === 'undefined' 
  ? createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )
  : null as any;
