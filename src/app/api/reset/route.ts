import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  await supabaseAdmin.from('users').update({ is_pro: false }).neq('email', 'null');
  return NextResponse.json({ success: true, message: "Reset to free" });
}
