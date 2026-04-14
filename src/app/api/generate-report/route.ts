export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const qstashToken = process.env.QSTASH_TOKEN;
    if (!qstashToken) {
      throw new Error('QSTASH_TOKEN is not configured in environment variables.');
    }
    const qstash = new Client({ token: qstashToken });
    
    const body = await request.json();
    const reportId = crypto.randomUUID();

    // 1. Create DB entry: pending
    const { error: dbError } = await supabaseAdmin
      .from('reports')
      .insert([
        {
          id: reportId,
          status: 'pending',
          data: null,
          error_message: null
        }
      ]);
      
    if (dbError) throw new Error('Database Error: ' + dbError.message);

    // 2. Publish to QStash
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const workerUrl = `${protocol}://${host}/api/worker/generate-report`;
    
    // Note for Concurrency Limit: To restrict concurrency, you should configure a QStash Queue 
    // in the Upstash UI (e.g. max 2-3 parallelism) and pass the queue name here if desired, 
    // or set it as default queue. We are just using standard publish for now.
    await qstash.publishJSON({
      url: workerUrl,
      body: { reportId, payload: body },
      retries: 0 // Optional: avoid QStash auto-retrying since we do manual LLM retries inside the worker.
    });

    // 3. Return reportId so the frontend can start polling
    return NextResponse.json({ reportId });

  } catch (error: any) {
    console.error('Producer Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to start background job.' }, { status: 500 });
  }
}
