import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    const userEmail = session?.user?.email;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const DODO_API_KEY = process.env.DODO_API_KEY;
    if (!DODO_API_KEY) {
      return NextResponse.json({ error: 'Missing DODO_API_KEY' }, { status: 500 });
    }

    const { productId } = await request.json();

    // Use the official domain. Try test.dodopayments.com or live.dodopayments.com
    const response = await fetch("https://test.dodopayments.com/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DODO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        billing: {
          country: "US", // Dodo requires a country code
        },
        customer: {
          email: userEmail,
          name: session?.user?.name || 'Valued Customer'
        },
        product_id: productId, // Usually passed from env or client
        quantity: 1, // Required by Dodo API
        payment_link: true,
        return_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/?success=true`
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Dodo API Error:', errorData);
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    const data = await response.json();

    // Check Dodo API docs for the exact property that holds the checkout URL.
    // Usually it's something like data.payment_link or data.url.
    // We'll return it so the frontend can redirect the user.
    return NextResponse.json({ url: data.payment_link ?? data.url ?? data.checkout_url });

  } catch (err: any) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
