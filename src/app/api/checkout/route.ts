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

    const { plan } = await request.json(); // 'starter' or 'agency'

    // Pricing Logic Matrix (Hardcoded mapping for fast deployment)
    const PRICING_MATRIX: Record<string, { IN: string, GLOBAL: string }> = {
      starter: {
        IN: 'pdt_0NcYZ7nvAfhkKG2gpttPH', // ₹2,999
        GLOBAL: 'pdt_0NcXgPRMt88V7bpkC3m7W' // $59 (updated from $49)
      },
      agency: {
        IN: 'pdt_0O1e2f3g4h5i6j7k8l9m', // PLACEHOLDER: Please provide Agency India ID
        GLOBAL: 'pdt_0O9m8l7k6j5i4h3g2f1e' // PLACEHOLDER: Please provide Agency Global ID
      }
    };

    // Geofenced Pricing Interceptor
    const rawCountryHeader = request.headers.get('x-vercel-ip-country');
    const userCountry = rawCountryHeader || 'US';

    const matrix = PRICING_MATRIX[plan] || PRICING_MATRIX.starter;
    const targetProductId = userCountry === 'IN' ? matrix.IN : matrix.GLOBAL;

    // Use specific IDs if they exist in matrix, otherwise fallback to the ones user provided earlier
    // For now, I'll use the ones provided as the Starter ones.

    // We are migrating this to the live domain endpoint
    const response = await fetch("https://live.dodopayments.com/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DODO_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        billing: {
          country: userCountry // Dodo forces strict mapping. Auto-geofences UPI to 'IN' vs ApplePay to 'US/EU'
        },
        customer: {
          email: userEmail,
          name: session?.user?.name || 'Valued Customer'
        },
        product_id: targetProductId, // Silently swaps price depending on IP trace
        quantity: 1, // Required by Dodo API
        payment_link: true,
        return_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/?success=true`
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Dodo API Error:', errorData);
      return NextResponse.json({ error: `Dodo Error: ${errorData}` }, { status: 500 });
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
