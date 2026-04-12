import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

// Admin client for server-side actions (bypasses RLS)
if (typeof window === 'undefined') {
  console.log('--- SUPABASE ADMIN INIT ---');
  console.log('URL Length:', supabaseUrl.length);
  console.log('Secret Key exists:', !!serviceRoleKey);
  if (serviceRoleKey) {
    console.log('Secret Key Preview:', `${serviceRoleKey.substring(0, 5)}...${serviceRoleKey.substring(serviceRoleKey.length - 3)}`);
  }
}

export const supabaseAdmin = typeof window === 'undefined' 
  ? createClient(supabaseUrl, serviceRoleKey)
  : null as any;
