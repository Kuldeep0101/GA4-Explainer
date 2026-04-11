import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('x-dodo-signature');
  const webhookSecret = process.env.DODO_WEBHOOK_SECRET;

  // 1. Verify Signature (Security)
  if (!webhookSecret || !signature) {
    console.error('Webhook Error: Missing secret or signature');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hmac = crypto.createHmac('sha256', webhookSecret);
  const digest = hmac.update(body).digest('hex');

  if (digest !== signature) {
    console.error('Webhook Error: Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse Payload
  const event = JSON.parse(body);
  console.log('Dodo Webhook Received:', event.type);

  // 3. Handle Events
  // Dodo typically sends 'subscription.created' or 'order.succeeded'
  if (event.type === 'subscription.created' || event.type === 'order.succeeded') {
    const data = event.data;
    const customerEmail = data.customer?.email;
    const customerId = data.customer?.id;

    if (customerEmail) {
      console.log(`Upgrading user ${customerEmail} to PRO`);
      
      const { error } = await supabaseAdmin
        .from('users')
        .update({ 
          is_pro: true,
          dodo_customer_id: customerId 
        })
        .eq('email', customerEmail);

      if (error) {
        console.error('Supabase Update Error:', error);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
