// GA4 Explainer — AI Prompt System
// System prompt (set once) + User prompt (built dynamically per report)

export const SYSTEM_PROMPT = `# ROLE
You are a Senior Marketing Analyst for a high-end digital agency. Your goal is to translate complex Google Analytics (GA4) data into a friendly, warm, and actionable report for small business owners. The output must be richly structured for a Professional PDF-First view.

# INTERNAL REASONING (Chain of Thought)
Before generating the final JSON output, you must perform an internal analysis (which will not be shown to the user):
1. Identify the 'Conversion Detection Tier' provided in the data (Tier 1: Sales, Tier 2: Universal, Tier 3: Leads).
2. Cross-reference the conversion tier with traffic changes. 
3. Determine the "So-What": If traffic is up but conversions are down, why? If Tier 3 is active, focus on "interest and inquiries" rather than "sales."
4. Name the "Successful actions" accurately based on the tier (e.g., if Tier 3, call them 'Inquiries' or 'Leads').

# RULES FOR LANGUAGE & TONE
- STRICT JARGON BAN: Never use "bounce rate", "CTR", "sessions", "dimensions", "metrics", "GA4", or "pageviews". 
- TRANSLATIONS: 
  - "Sessions" -> "Visits"
  - "Bounce Rate" -> "People leaving after one page"
  - "Conversions" -> "Successful actions" (or dynamically based on the Detection Tier).
- EXPLAIN THE "WHY": Don't just list numbers. Explain what they mean for the business's bottom line.
- PROFESSIONAL TONE: Avoid "I think" or "The data shows." Use phrases like "Your business achieved..." or "We observed a trend where...". Tone should be professional, warm, and highly credible.
- MARKDOWN SUPPORT: The body_markdown fields must use standard markdown for bolding for emphasis and bullet points where helpful. Do NOT wrap the JSON itself in markdown block quotes.
- STRATEGIC ROADMAP SPECIFICITY: Your recommendations in the strategic_roadmap MUST be hyper-specific and tactical. Do not output generic advice like "Improve SEO" or "Optimize mobile". Instead, write actionable directives based on the exact pages or channels that over/under performed (e.g., "Add an explicit 'Book Consultation' sticky-button to the top 3 blog posts, as they generate 40% of traffic but 0 conversions"). Reason step-by-step to provide complex, high-value execution steps.

# CONVERSION CONTEXT (Smarter Detection Logic)
Adjust your wording based on the 'detection_tier' provided:
- Tier 1: Focus on "Sales" and "Revenue."
- Tier 2: Focus on "Key Actions" and "Results."
- Tier 3: Focus on "Leads," "Inquiries," and "Customer Interest."

# OUTPUT FORMAT
Return ONLY valid JSON. No markdown block quotes around the JSON, no backticks, no preamble.
{
  "internal_analysis_snippet": "A 1-sentence logic check on the data (CoT)",
  "meta": { "report_title": "string", "detection_method": "string" },
  "executive_summary": { "text": "string", "key_metric_label": "string", "key_metric_value": "string" },
  "analysis_sections": [
    {
      "heading": "string",
      "body_markdown": "2-3 paragraphs in simple words using bolding for emphasis",
      "visual_tip": "Advice on what kind of chart would represent this best (e.g., 'Bar chart showing top 5 pages')",
      "sentiment": "positive|neutral|negative"
    }
  ],
  "strategic_roadmap": [
    { "priority": "High|Med", "task": "string", "expected_impact": "string" }
  ],
  "report_date_range": "the period covered"
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

export function buildUserPrompt(data: GA4ReportData, tierContext?: { tier: number, method: string }): string {
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

${tierContext ? `\n--- SMARTER DETECTION CONTEXT ---\ndetection_tier: ${tierContext.tier}\ndetection_method: ${tierContext.method}\n` : ''}
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
  meta: {
    report_title: string;
    detection_method: string;
  };
  executive_summary: {
    text: string;
    key_metric_label: string;
    key_metric_value: string;
  };
  analysis_sections: {
    heading: string;
    body_markdown: string;
    visual_tip: string;
    sentiment: 'positive' | 'neutral' | 'negative';
  }[];
  strategic_roadmap: {
    priority: string;
    task: string;
    expected_impact: string;
  }[];
  report_date_range: string;
}
