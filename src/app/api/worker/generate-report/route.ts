export const runtime = 'nodejs';
export const maxDuration = 60;

import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { GoogleGenAI } from '@google/genai';
import { OpenAI } from 'openai';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchGA4Data } from '@/lib/ga4';

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

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT_40s')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
};

async function executeModelCall(modelName: string, systemPrompt: string, userPrompt: string) {
  if (modelName === 'gemini-2.5-pro') {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: userPrompt,
      config: { 
        systemInstruction: systemPrompt,
        temperature: 0.3,
        responseMimeType: 'application/json' // Enforce strict JSON
      }
    });
    return response.text;
  } else if (modelName === 'deepseek-v3.2') {
    const deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseURL: 'https://api.deepseek.com/v1',
    });
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat', 
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });
    return response.choices[0].message.content;
  } else if (modelName === 'llama-3.3-70b') {
    const groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY || '',
      baseURL: 'https://api.groq.com/openai/v1',
    });
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });
    return response.choices[0].message.content;
  }
  throw new Error(`Unsupported model: ${modelName}`);
}

async function getAIGeneratedSummaryWithFailover(systemPrompt: string, userPrompt: string) {
  const models = ['deepseek-v3.2', 'gemini-2.5-pro', 'llama-3.3-70b'];
  const attemptOrder = [...models].sort(() => Math.random() - 0.5);
  let lastError = null;

  for (const model of attemptOrder) {
    try {
      console.log(`[Worker] Attempting with model: ${model}`);
      const responseText = await withTimeout(executeModelCall(model, systemPrompt, userPrompt), 40000);
      return { text: responseText, model };
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      console.warn(`[Worker] ${model} failed:`, errorMsg);
      lastError = error;
      
      const lowerMsg = errorMsg.toLowerCase();
      const isRetryableError = lowerMsg.includes('429') || lowerMsg.includes('rate limit') || lowerMsg.includes('503') || lowerMsg.includes('unavailable') || lowerMsg.includes('timeout') || lowerMsg.includes('timeout_40s');
      
      if (!isRetryableError) {
        console.warn(`[Worker] Error might not be network/limits, but trying next anyway...`);
      }
    }
  }

  throw new Error(`All models failed. Servers are currently busy. Please try again in a few minutes.`);
}

export async function POST(request: Request) {
  const signature = request.headers.get('upstash-signature');
  const bodyText = await request.text();

  // Validate QStash Signature (Security)
  // Risk 3 Fix: If signing keys are configured (i.e. production), the signature header MUST be present.
  // Only skip validation when keys are genuinely absent (local dev without .env set).
  if (process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY) {
    if (!signature) {
      console.error('[Worker] Signature header missing — rejecting unauthenticated request.');
      return NextResponse.json({ error: 'Missing QStash signature' }, { status: 401 });
    }
    try {
      const receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
      });
      const isValid = await receiver.verify({ signature, body: bodyText });
      if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    } catch (err) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  } else {
    console.warn('[Worker] QStash signing keys not set — skipping validation (Local Dev mode).');
  }

  const { reportId, payload } = JSON.parse(bodyText);
  if (!reportId) return NextResponse.json({ error: 'Missing reportId' }, { status: 400 });

  const updateStatus = async (status: string, data: any = null, errorObj: any = null) => {
    const errorMsg = errorObj?.message || errorObj || null;
    await supabaseAdmin.from('reports').update({ 
      status, 
      ...(data && { data }),
      ...(errorMsg && { error_message: errorMsg })
    }).eq('id', reportId);
  };

  try {
    const { clientName, propertyId, dateRange } = payload;
    
    // Step 1: Connecting & Fetching GA4 Data
    await updateStatus('pending'); // Just to ensure it's pending first
    
    const today = new Date();
    const days = dateRange === '7' ? 7 : dateRange === '90' ? 90 : 30;
    
    const rawStats = await fetchGA4Data(propertyId, days);

    // Risk 1 Fix: Zero-traffic hallucination guard
    // If the property has no data at all, abort early instead of letting the AI invent insights.
    const totalUsersNum = parseInt(rawStats.totalUsers?.toString().replace(/,/g, '') || '0');
    if (totalUsersNum === 0) {
      await updateStatus('failed', null, 'No traffic data found for this property in the selected date range. Please check that the Service Account has been added as a Viewer in GA4, or try a wider date range.');
      return NextResponse.json({ error: 'No traffic data' }, { status: 200 });
    }

    // Determine 'Smarter Detection' Tier dynamically
    let detectedTier = 2;
    let detectedMethod = 'Fallback Universal Tier';
    const conversionsList = rawStats.conversions || [];
    const conversionNames = conversionsList.map((c: any) => c.eventName.toLowerCase());
    
    const salesEvents = ['purchase', 'add_to_cart', 'begin_checkout', 'ecommerce_purchase'];
    const leadEvents = ['generate_lead', 'submit_form', 'contact', 'sign_up', 'signup', 'form_submit', 'request_quote'];

    if (conversionNames.some((name: string) => salesEvents.includes(name))) {
      detectedTier = 1;
      detectedMethod = 'E-commerce Events Detected';
    } else if (conversionNames.some((name: string) => leadEvents.includes(name))) {
      detectedTier = 3;
      detectedMethod = 'Lead-Gen Events Detected';
    }

    // Step 2: Simplifying
    await updateStatus('simplifying');
    const simplifiedData = simplifyGA4Data(rawStats);

    // Step 3: Analyzing
    await updateStatus('analyzing');
    
    const endDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const startDate = new Date(today.getTime() - days * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const detectionContext = { tier: detectedTier, method: detectedMethod, simplified_data: simplifiedData };
    const userPrompt = `Client: ${clientName}\n\nDetection Context:\n${JSON.stringify({ detection_context: detectionContext })}\n\nIMPORTANT: Return ONLY a raw JSON object. Do not wrap it in markdown block quotes (\`\`\`). NEVER use raw unescaped newlines inside JSON strings (use \\n instead).`;

    const aiResponse = await getAIGeneratedSummaryWithFailover(SYSTEM_PROMPT, userPrompt);

    let report: any;
    try {
      const text = aiResponse.text || '';
      const clean = text.replace(/\`\`\`json|\`\`\`/g, '').trim();
      report = JSON.parse(clean);
    } catch (parseError) {
      throw new Error('AI returned invalid JSON');
    }

    if (!report.report_date_range) report.report_date_range = `${startDate} to ${endDate}`;
    
    if (report.internal_analysis_snippet) {
      console.log('--- AI REASONING (CoT) ---');
      console.log(report.internal_analysis_snippet);
      delete report.internal_analysis_snippet;
    }

    // Include the model used for UI debugging
    report.__model_used = aiResponse.model;

    // Step 4: Completed
    await updateStatus('completed', { report, stats: rawStats });
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Worker Error:', error);
    await updateStatus('failed', null, error.message || 'Servers are currently busy. Please try again in a few minutes.');
    // Return 200 so QStash doesn't keep retrying if it's a fatal application error. 
    // QStash retries indefinitely on non-2xx status codes by default.
    return NextResponse.json({ error: error.message || 'Worker Failed' }, { status: 200 });
  }
}
