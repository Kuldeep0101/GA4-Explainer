import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email, pdfBase64, clientName, senderEmail } = await req.json();

    if (!email || !pdfBase64) {
      return NextResponse.json({ error: 'Email and PDF are required' }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: 'Resend API key is missing' }, { status: 500 });
    }

    // Strip out the data URI prefix if present
    const base64Content = pdfBase64.replace(/^data:application\/pdf;base64,/, '');

    const result = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'GA4 Explainer <onboarding@resend.dev>', // MUST use a verified domain in Resend
      replyTo: senderEmail, // So clients can securely reply directly to the agency!
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

    // Resend SDK does not throw exceptions for 403/Validation errors, it returns them in the payload.
    // We must manually reject them so the Frontend Toast shows the Red Error UI.
    if (result.error) {
      console.error('Resend API Error:', result.error);
      return NextResponse.json({ error: result.error.message }, { status: result.error.statusCode || 400 });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error: any) {
    console.error('Email sending error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
