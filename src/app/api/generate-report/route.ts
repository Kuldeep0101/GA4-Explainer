export const runtime = 'edge'; // Bypasses Vercel's 10s serverless timeout

import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT, buildUserPrompt, GA4ReportData, ParsedReport } from '@/lib/prompts';

// Helper for token optimization
function simplifyGA4Data(rawStats: any) {
  // If we had raw RunReportResponse JSON, we would map over rows here to eliminate dimensionValues/metricValues.
  // Since our GA4 route already flattened much of it, we ensure it's mathematically clean and stripped
  // of any heavy metadata.
  return {
    traffic: {
      total: rawStats?.totalUsers || '0',
      new: rawStats?.newUsers || '0',
      returning: rawStats?.returningUsers || '0',
    },
    engagement: {
      sessions: rawStats?.sessions || '0',
      avgSeconds: rawStats?.avgSessionDuration || '0',
      bounceRate: rawStats?.bounceRate || '0',
      pagesPerVisit: rawStats?.pagesPerSession || '0',
    },
    sources: {
      organic: rawStats?.organicSearchUsers || '0',
      direct: rawStats?.directUsers || '0',
      social: rawStats?.socialUsers || '0',
      referral: rawStats?.referralUsers || '0',
      paid: rawStats?.paidUsers || '0',
    },
    pages: (rawStats?.topPages || []).map((p: any) => ({ url: p.url, views: p.count })),
    conversions: (rawStats?.conversions || []).map((c: any) => ({ event: c.eventName, count: c.count })),
    devices: {
      desktop: rawStats?.desktopPct || '0',
      mobile: rawStats?.mobilePct || '0',
    },
    comparisons: {
      prevUsers: rawStats?.prevTotalUsers || '0',
      prevBounce: rawStats?.prevBounceRate || '0',
      prevConversions: rawStats?.prevConversionsTotal || '0',
    }
  };
}

// Helper sleep function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function getAIGeneratedSummary(simplifiedData: any, clientName: string) {
  const userPrompt = `Client: ${clientName}\nFlat Data (JSON): ${JSON.stringify(simplifiedData)}`;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  const combinedPrompt = `${SYSTEM_PROMPT}\n\nUser Data:\n${userPrompt}\n\nIMPORTANT: Return ONLY a raw JSON object. Do not wrap it in markdown block quotes (\`\`\`). NEVER use raw unescaped newlines inside JSON strings (use \\n instead).`;

  console.log('--- GEMINI REQUEST START ---');
  console.log('Sending optimized data for:', clientName);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: combinedPrompt,
      config: {
        temperature: 0.3,
      }
    });

    const rawText = response.text || '';
    console.log('Gemini 1.5 Flash response length:', rawText.length);
    return { text: rawText, model: 'gemini-1.5-flash' };
  } catch (error: any) {
    const errorMsg = error.message || '';
    const isRetryable = errorMsg.includes('503') || errorMsg.includes('429');
    if (isRetryable) {
      console.warn('Primary model (gemini-1.5-flash) failed (503/429). Falling back immediately to gemini-1.5-flash-8b.', error.message);
    } else {
      console.warn('Primary model failed with unexpected error. Attempting fallback anyway.', error.message);
    }

    const fallbackResponse = await ai.models.generateContent({
      model: 'gemini-1.5-flash-8b',
      contents: combinedPrompt,
      config: {
        temperature: 0.3,
      }
    });

    const rawFallbackText = fallbackResponse.text || '';
    console.log('Gemini 1.5-8b Fallback response length:', rawFallbackText.length);
    return { text: rawFallbackText, model: 'gemini-1.5-flash-8b' };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientName, stats, dateRange } = body;

    // Build date strings based on the range
    const today = new Date();
    const days = dateRange === '7' ? 7 : dateRange === '90' ? 90 : 30;
    const prevDays = days * 2;

    const endDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const startDate = new Date(today.getTime() - days * 86400000)
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // If no API key, return rich mock data
    if (!process.env.GEMINI_API_KEY) {
      // ... mock report returning
      console.warn('Missing GEMINI_API_KEY. Returning mock report.');
      const mockReport: ParsedReport = {
        summary: `Mock summary for ${clientName}`,
        highlights: [],
        recommendations: [],
        report_date_range: `${startDate} to ${endDate}`,
      };
      return NextResponse.json({ report: mockReport });
    }

    // Prepare optimized GA4 data payload
    const simplifiedData = simplifyGA4Data(stats);

    // Call abstraction function
    const aiResponse = await getAIGeneratedSummary(simplifiedData, clientName);

    // Parse JSON — strip accidental markdown fences if present
    let report: ParsedReport;
    try {
      const clean = aiResponse.text.replace(/```json|```/g, '').trim();
      report = JSON.parse(clean);
    } catch (parseError) {
      console.error('JSON Parse Error. Raw Text:', aiResponse.text);
      throw new Error('AI returned invalid JSON format');
    }

    // Fill in report date range
    if (!report.report_date_range) {
      report.report_date_range = `${startDate} to ${endDate}`;
    }

    console.log(`--- SUCCESS: Model Used -> ${aiResponse.model} ---`);
    return NextResponse.json({ report, model: aiResponse.model });

  } catch (error: any) {
    console.error('Report Generation Error:', error);
    return NextResponse.json({ error: error.message || 'AI Generation Failed' }, { status: 500 });
  }
}
