import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(req: Request) {
  const body = await req.text();

  console.log('--- DODO WEBHOOK START ---');
  
  // Header Spy: Log all incoming headers to find the signature key
  const headersObj: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headersObj[key] = value;
  });
  console.log('All Headers Received:', JSON.stringify(headersObj, null, 2));

  // Try multiple common signature header names
  const signature = req.headers.get('webhook-signature') || req.headers.get('x-dodo-signature') || '';
  const timestamp = req.headers.get('webhook-timestamp') || '';
  const msgId = req.headers.get('webhook-id') || '';
  const webhookSecret = process.env.DODO_WEBHOOK_SECRET || '';

  console.log('Found Signature:', signature);
  console.log('Found Timestamp:', timestamp);
  console.log('Found MsgId:', msgId);

  // 1. Verify Signature (Svix/Dodo standard)
  if (!webhookSecret || !signature || !timestamp || !msgId) {
    console.error('Webhook Error: Missing secret, signature, timestamp, or msgId');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Svix signature format: v1,base64_hash
  const signedPayload = `${msgId}.${timestamp}.${body}`;
  const secretBytes = webhookSecret.split('_')[1] || webhookSecret; // Handle 'whsec_' prefix if present
  
  const hmac = crypto.createHmac('sha256', secretBytes);
  const calculatedSignature = hmac.update(signedPayload).digest('base64');
  
  const expectedSignature = signature.split(',')[1]; // Get the part after 'v1,'

  if (calculatedSignature !== expectedSignature) {
    console.error('Webhook Error: Invalid Svix signature.');
    console.error('Calculated:', calculatedSignature);
    console.error('Expected:', expectedSignature);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse Payload
  const event = JSON.parse(body);
  console.log('Event Type:', event.type);
  console.log('Full Event Data:', JSON.stringify(event, null, 2));

  // 3. Handle Events
  // Dodo sends various events like 'subscription.created', 'order.succeeded', etc.
  if (event && event.type && (event.type.includes('subscription') || event.type.includes('order') || event.type.includes('payment'))) {
    const data = event.data;
    // Try to find email in multiple common locations
    const customerEmail = data?.customer?.email || data?.email || event.customer_email || event.data?.email;
    const customerId = data?.customer?.id || data?.customer_id;

    if (customerEmail) {
      console.log(`STAGING UPGRADE: User ${customerEmail}`);
      
      const { data: updateData, error } = await supabaseAdmin
        .from('users')
        .update({ 
          is_pro: true,
          dodo_customer_id: customerId 
        })
        .eq('email', customerEmail.toLowerCase())
        .select();

      if (error) {
        console.error('Supabase Update Error:', error);
      } else {
        console.log('SUCCESS: User is now PRO in Database:', updateData);
      }
    } else {
      console.error('Webhook Error: No customer email found in payload');
    }
  }

  console.log('--- DODO WEBHOOK END ---');
  return NextResponse.json({ received: true });
}
