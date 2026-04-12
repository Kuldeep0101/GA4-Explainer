import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(url, key);

async function reset() {
  const { data, error } = await supabase.from('users').update({ is_pro: false }).neq('email', 'null');
  if (error) console.error("Error:", error);
  else console.log("Success! Everyone is safely downgraded to Free.");
}

reset();
