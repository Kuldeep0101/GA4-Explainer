import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

export const supabaseAdmin = typeof window === 'undefined' 
  ? createClient(supabaseUrl, serviceRoleKey)
  : null as any;
