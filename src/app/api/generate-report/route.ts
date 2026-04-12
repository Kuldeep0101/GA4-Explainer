import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { SYSTEM_PROMPT, buildUserPrompt, GA4ReportData, ParsedReport } from '@/lib/prompts';

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
    const prevEndDate = new Date(today.getTime() - (days + 1) * 86400000)
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const prevStartDate = new Date(today.getTime() - prevDays * 86400000)
      .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // If no API key, return rich mock data
    if (!process.env.GEMINI_API_KEY) {
      console.warn('Missing GEMINI_API_KEY. Returning mock report.');
      const mockReport: ParsedReport = {
        summary: `${clientName}'s website had a strong month, with visitor numbers up significantly compared to the previous period. Engagement is healthy and your contact form is generating real leads.`,
        highlights: [
          {
            title: 'Visitor Growth',
            insight: `Your website welcomed ${stats?.totalUsers || '12,450'} visitors this period — a meaningful increase from last month. This growth is primarily driven by organic Google search, which means your SEO is paying off.`,
            sentiment: 'positive',
          },
          {
            title: 'Visitor Engagement',
            insight: `On average, visitors spent about 3 minutes on your site and browsed 3 pages per visit. This tells us people are genuinely interested in what they find — not just clicking away.`,
            sentiment: 'positive',
          },
          {
            title: 'Visitors Leaving Early',
            insight: `About 4 in 10 visitors left after viewing just one page. While this is fairly normal for sites with blog traffic, it's worth making sure your homepage clearly guides people to the next step.`,
            sentiment: 'neutral',
          },
          {
            title: 'Contact Form Performance',
            insight: `Your contact form received ${stats?.conversions?.[0]?.count || '218'} submissions this month — these are real people raising their hand to work with you. This is the most important number in this report.`,
            sentiment: 'positive',
          },
          {
            title: 'Mobile Visitors',
            insight: `${stats?.mobilePct || '43'}% of your visitors came from a phone. If the mobile experience isn't smooth, you may be losing leads before they even read your message.`,
            sentiment: 'neutral',
          },
        ],
        recommendations: [
          {
            action: 'Add a clear call-to-action button on every page (e.g. "Book a Free Call" or "Get a Quote")',
            reason: "Many visitors who are interested don't know what to do next. A prominent button converts browsers into leads.",
          },
          {
            action: 'Check your site on a phone this week — tap through every page as if you were a new visitor',
            reason: `With ${stats?.mobilePct || '43'}% mobile traffic, a slow or broken mobile experience is costing you leads.`,
          },
          {
            action: 'Write one new blog post this month targeting a question your customers ask frequently',
            reason: 'Your organic search traffic is growing — consistent content keeps that momentum building month over month.',
          },
        ],
        report_date_range: `${startDate} to ${endDate}`,
      };
      return NextResponse.json({ report: mockReport });
    }

    // Build the GA4ReportData object from incoming stats
    const ga4Data: GA4ReportData = {
      businessName: clientName,
      startDate,
      endDate,
      prevStartDate,
      prevEndDate,
      totalUsers: stats?.totalUsers || '0',
      newUsers: stats?.newUsers || '0',
      returningUsers: stats?.returningUsers || '0',
      sessions: stats?.sessions || '0',
      avgSessionDuration: stats?.avgSessionDuration || '0',
      bounceRate: stats?.bounceRate || '0',
      pagesPerSession: stats?.pagesPerSession || '0',
      topPages: stats?.topPages || [],
      organicSearchUsers: stats?.organicSearchUsers || '0',
      directUsers: stats?.directUsers || '0',
      socialUsers: stats?.socialUsers || '0',
      referralUsers: stats?.referralUsers || '0',
      paidUsers: stats?.paidUsers || '0',
      conversions: stats?.conversions || [],
      prevTotalUsers: stats?.prevTotalUsers || '0',
      prevBounceRate: stats?.prevBounceRate || '0',
      prevConversionsTotal: stats?.prevConversionsTotal || '0',
      desktopPct: stats?.desktopPct || '0',
      mobilePct: stats?.mobilePct || '0',
      tabletPct: stats?.tabletPct || '0',
      topCountries: stats?.topCountries || 'N/A',
    };

    const userPrompt = buildUserPrompt(ga4Data);

    // Call Google Gemini
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    // We combine the system prompt and user prompt manually since v1 
    // doesn't natively support systemInstruction in the config yet.
    const combinedPrompt = `${SYSTEM_PROMPT}\n\nUser Data:\n${userPrompt}\n\nIMPORTANT: Return ONLY a raw JSON object. Do not wrap it in markdown block quotes (\`\`\`). NEVER use raw unescaped newlines inside JSON strings (use \\n instead).`;

    console.log('--- GEMINI REQUEST START ---');
    console.log('Sending data for:', clientName);
    
    // Using correct syntax for @google/genai (version 1.x)
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: combinedPrompt
    });

    const rawText = response.text || '';
    console.log('Gemini raw response length:', rawText.length);

    // Parse JSON — strip accidental markdown fences if present
    let report: ParsedReport;
    try {
      // Handle the case where Gemini returns code blocks
      const clean = rawText.replace(/```json|```/g, '').trim();
      report = JSON.parse(clean);
    } catch (parseError) {
      console.error('JSON Parse Error. Raw Text:', rawText);
      throw new Error('AI returned invalid JSON format');
    }

    console.log('--- GEMINI REQUEST SUCCESS ---');
    return NextResponse.json({ report });

  } catch (error: any) {
    console.error('Report Generation Error:', error);
    return NextResponse.json({ error: error.message || 'AI Generation Failed' }, { status: 500 });
  }
}
