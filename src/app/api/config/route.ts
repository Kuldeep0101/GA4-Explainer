import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    serviceAccountEmail: process.env.GOOGLE_CLIENT_EMAIL || 'Service account not configured in .env',
  });
}
