// GA4 Explainer — AI Prompt System
// System prompt (set once) + User prompt (built dynamically per report)

export const SYSTEM_PROMPT = `You are a marketing analyst writing monthly website performance reports for small business owners and their clients. Your job is to translate raw Google Analytics data into clear, friendly, actionable English that someone with zero technical knowledge can understand.

Rules you must always follow:
- Never use technical jargon (no "bounce rate", "sessions", "CTR", "dimensions", "metrics", "GA4", "pageviews"). Replace every technical term with plain language.
- Always explain what a number MEANS, not just what it is. Don't say "bounce rate was 72%." Say "7 out of 10 visitors left after viewing just one page."
- Always include a so-what: why does this number matter to the business?
- Compare to the previous period if data is provided. Use plain language like "more than last month" or "down compared to October."
- When something went well, say so clearly and warmly. When something is a concern, be honest but constructive — never alarming.
- Keep each insight to 2-3 sentences maximum.
- End every report with exactly 3 specific, actionable recommendations the business can act on this month.
- Write in second person ("your website", "your visitors") — this is their report.
- Tone: professional but warm. Like a trusted advisor, not a robot or a consultant trying to sound smart.

Output format — return ONLY valid JSON, no markdown, no backticks, no preamble:
{
  "summary": "2-3 sentence executive summary of the month",
  "highlights": [
    { "title": "short title", "insight": "2-3 sentence plain-English explanation", "sentiment": "positive|neutral|negative" }
  ],
  "recommendations": [
    { "action": "specific thing to do", "reason": "why it matters" }
  ],
  "report_date_range": "the period this report covers"
}`;


export interface GA4ReportData {
  businessName: string;
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
  // Current period
  totalUsers: string;
  newUsers: string;
  returningUsers: string;
  sessions: string;
  avgSessionDuration: string;
  bounceRate: string;
  pagesPerSession: string;
  // Top pages
  topPages: { name: string; url: string; count: string }[];
  // Traffic sources
  organicSearchUsers: string;
  directUsers: string;
  socialUsers: string;
  referralUsers: string;
  paidUsers: string;
  // Conversions
  conversions: { eventName: string; count: string }[];
  // Previous period (for comparison)
  prevTotalUsers: string;
  prevBounceRate: string;
  prevConversionsTotal: string;
  // Device breakdown
  desktopPct: string;
  mobilePct: string;
  tabletPct: string;
  // Countries
  topCountries: string;
}

export function buildUserPrompt(data: GA4ReportData): string {
  const topPagesStr = data.topPages
    .map(p => `${p.name} | ${p.url} | ${p.count} visitors`)
    .join('\n');

  const conversionsStr = data.conversions
    .map(c => `${c.eventName} | ${c.count}`)
    .join('\n');

  return `Generate a plain-English website performance report for the following data.

Business name: ${data.businessName}
Report period: ${data.startDate} to ${data.endDate}
Previous period: ${data.prevStartDate} to ${data.prevEndDate}

--- CURRENT PERIOD DATA ---
Total visitors: ${data.totalUsers}
New visitors: ${data.newUsers}
Returning visitors: ${data.returningUsers}
Total sessions: ${data.sessions}
Average session duration: ${data.avgSessionDuration} seconds
Bounce rate: ${data.bounceRate}%
Pages per session: ${data.pagesPerSession}

Top 5 pages visited:
${topPagesStr}

Where visitors came from:
- Google Search: ${data.organicSearchUsers} visitors
- Direct (typed URL): ${data.directUsers} visitors
- Social media: ${data.socialUsers} visitors
- Referral (other websites): ${data.referralUsers} visitors
- Paid ads: ${data.paidUsers} visitors

Conversions (key actions taken):
${conversionsStr}

--- PREVIOUS PERIOD DATA (for comparison) ---
Total visitors: ${data.prevTotalUsers}
Bounce rate: ${data.prevBounceRate}%
Conversions: ${data.prevConversionsTotal}

Device breakdown:
- Desktop: ${data.desktopPct}%
- Mobile: ${data.mobilePct}%
- Tablet: ${data.tabletPct}%

Country breakdown (top 3): ${data.topCountries}`;
}

// Parsed report shape
export interface ParsedReport {
  summary: string;
  highlights: {
    title: string;
    insight: string;
    sentiment: 'positive' | 'neutral' | 'negative';
  }[];
  recommendations: {
    action: string;
    reason: string;
  }[];
  report_date_range: string;
}
