export const runtime = 'nodejs';
export const maxDuration = 60; // 60s is max for Vercel Hobby plan

import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT, buildUserPrompt, GA4ReportData, ParsedReport } from '@/lib/prompts';

// Helper for token optimization
function simplifyGA4Data(rawStats: any) {
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

  console.log('--- AI GENERATION START ---');
  
  // Tier 1: Gemini 3.1 Lite (The Newest)
  try {
    console.time('model-tier-1');
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-preview',
      contents: combinedPrompt,
      config: { temperature: 0.3, // @ts-ignore
        thinkingConfig: { thinking_level: 'low' } }
    });
    console.timeEnd('model-tier-1');
    return { text: response.text, model: 'gemini-3.1-flash-lite-preview' };
  } catch (error: any) {
    console.timeEnd('model-tier-1');
    console.warn('Tier 1 failed (503/429), switching to Tier 2 in 1s...', error.message);
    await delay(1000);
  }

  // Tier 2: Gemini 2.5 Flash (Preferred Fallback)
  try {
    console.time('model-tier-2');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: combinedPrompt,
      config: { temperature: 0.3 }
    });
    console.timeEnd('model-tier-2');
    return { text: response.text, model: 'gemini-2.5-flash' };
  } catch (error: any) {
    console.timeEnd('model-tier-2');
    console.warn('Tier 2 failed, switching to Tier 3 (Workhorse)...', error.message);
  }

  // Tier 3: Gemini 1.5 Flash (The Reliable One)
  console.time('model-tier-3');
  const response = await ai.models.generateContent({
    model: 'gemini-1.5-flash',
    contents: combinedPrompt,
    config: { temperature: 0.3 }
  });
  console.timeEnd('model-tier-3');
  return { text: response.text, model: 'gemini-1.5-flash' };
}

export async function POST(request: Request) {
  console.time('total-report-gen');
  try {
    const body = await request.json();
    const { clientName, stats, dateRange } = body;

    const today = new Date();
    const days = dateRange === '7' ? 7 : dateRange === '90' ? 90 : 30;
    const endDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const startDate = new Date(today.getTime() - days * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ report: { summary: 'Mock', report_date_range: '...' } });
    }

    const simplifiedData = simplifyGA4Data(stats);
    
    // Call the 3-tier AI logic
    const aiResponse = await getAIGeneratedSummary(simplifiedData, clientName);

    let report: ParsedReport;
    try {
      const text = aiResponse.text || '';
      const clean = text.replace(/```json|```/g, '').trim();
      report = JSON.parse(clean);
    } catch (parseError) {
      throw new Error('AI returned invalid JSON');
    }

    if (!report.report_date_range) report.report_date_range = `${startDate} to ${endDate}`;

    console.timeEnd('total-report-gen');
    console.log(`--- SUCCESS: Model Used -> ${aiResponse.model} ---`);
    return NextResponse.json({ report, model: aiResponse.model });

  } catch (error: any) {
    console.timeEnd('total-report-gen');
    console.error('Report Generation Error:', error);
    return NextResponse.json({ error: error.message || 'AI Generation Failed' }, { status: 500 });
  }
}
