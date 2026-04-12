import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email, pdfBase64, clientName } = await req.json();

    if (!email || !pdfBase64) {
      return NextResponse.json({ error: 'Email and PDF are required' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Resend API key is missing' }, { status: 500 });
    }

    // Strip out the data URI prefix if present
    const base64Content = pdfBase64.replace(/^data:application\/pdf;base64,/, '');

    const data = await resend.emails.send({
      from: 'GA4 Explainer <onboarding@resend.dev>', // Resend test email. Must verify domain for custom from address.
      to: [email],
      subject: `${clientName} - Plain-English GA4 Report`,
      text: `Hello,\n\nPlease find attached the latest website performance report for ${clientName}.\n\nBest regards,\nYour Agency`,
      attachments: [
        {
          filename: `${clientName.replace(/\s+/g, '_')}_GA4_Report.pdf`,
          content: base64Content,
        },
      ],
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Email sending error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
