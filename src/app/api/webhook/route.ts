import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(req: Request) {
  const body = await req.text();

  // Try multiple common signature header names
  const signature = req.headers.get('webhook-signature') || req.headers.get('x-dodo-signature') || '';
  const timestamp = req.headers.get('webhook-timestamp') || '';
  const msgId = req.headers.get('webhook-id') || '';
  const webhookSecret = process.env.DODO_WEBHOOK_SECRET || '';

  // 1. Verify Signature (Svix/Dodo standard)
  if (!webhookSecret || !signature || !timestamp || !msgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Svix signature format: v1,base64_hash
  const signedPayload = `${msgId}.${timestamp}.${body}`;
  const secretPart = webhookSecret.split('_')[1] || webhookSecret; // Handle 'whsec_' prefix
  const secretBuffer = Buffer.from(secretPart, 'base64');
  
  const hmac = crypto.createHmac('sha256', secretBuffer);
  const calculatedSignature = hmac.update(signedPayload).digest('base64');
  
  const expectedSignature = signature.split(',')[1]; // Get the part after 'v1,'

  if (calculatedSignature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse Payload
  const event = JSON.parse(body);

  // 3. Handle Events
  // Dodo sends various events like 'subscription.created', 'order.succeeded', etc.
  if (event && event.type && (event.type.includes('subscription') || event.type.includes('order') || event.type.includes('payment'))) {
    const data = event.data;
    // Try to find email in multiple common locations
    const customerEmail = data?.customer?.email || data?.email || event.customer_email || event.data?.email;
    const customerId = data?.customer?.id || data?.customer_id;

    if (customerEmail) {
      const { error } = await supabaseAdmin
        .from('users')
        .update({ 
          is_pro: true,
          dodo_customer_id: customerId 
        })
        .eq('email', customerEmail.toLowerCase());

      if (error) {
        console.error('Supabase Update Error:', error);
      }
    }
  }

  console.log('--- DODO WEBHOOK END ---');
  return NextResponse.json({ received: true });
}
