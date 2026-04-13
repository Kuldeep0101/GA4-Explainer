import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { NextResponse } from 'next/server';

function formatDuration(seconds: number): string {
  if (isNaN(seconds)) return '0';
  return Math.round(seconds).toString();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const propertyId = searchParams.get('propertyId');

  if (!propertyId) {
    return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
  }

  // If credentials aren't provided, return rich mock data for development/MVP
  if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.warn('Missing Google Credentials. Returning mock GA4 data.');
    return NextResponse.json({
      propertyId,
      mock: true,
      data: {
        totalUsers: '12,450',
        newUsers: '9,812',
        returningUsers: '2,638',
        sessions: '15,200',
        avgSessionDuration: '187',
        bounceRate: '42.3',
        pagesPerSession: '3.1',
        topPages: [
          { name: 'Home', url: '/', count: '8,210' },
          { name: 'Pricing', url: '/pricing', count: '3,450' },
          { name: 'Blog: 10 Tips', url: '/blog/tips', count: '2,180' },
          { name: 'Contact', url: '/contact', count: '1,640' },
          { name: 'About Us', url: '/about', count: '1,020' },
        ],
        organicSearchUsers: '5,400',
        directUsers: '3,100',
        socialUsers: '1,800',
        referralUsers: '1,200',
        paidUsers: '950',
        conversions: [
          { eventName: 'Contact Form Submit', count: '218' },
          { eventName: 'Newsletter Signup', count: '124' },
        ],
        prevTotalUsers: '10,890',
        prevBounceRate: '48.1',
        prevConversionsTotal: '298',
        desktopPct: '52',
        mobilePct: '43',
        tabletPct: '5',
        topCountries: 'United States (7,200), United Kingdom (2,100), Canada (1,050)',
      },
    });
  }

  try {
    const analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
    });

    const property = `properties/${propertyId.replace('properties/', '')}`;

    // Calculate dynamic dates based on frontend toggle
    const dateRangeParam = searchParams.get('dateRange') || '30';
    const days = parseInt(dateRangeParam, 10) || 30;
    
    const currentStartDate = `${days}daysAgo`;
    const currentEndDate = 'today';
    const prevStartDate = `${days * 2}daysAgo`;
    const prevEndDate = `${days + 1}daysAgo`;

    // Run all reports in parallel
    const [
      [mainResponse],
      [prevResponse],
      [pagesResponse],
      [channelResponse],
      [deviceResponse],
      [countryResponse],
      [convResponse],
    ] = await Promise.all([
      // Current period: core metrics
      analyticsDataClient.runReport({
        property,
        dateRanges: [{ startDate: currentStartDate, endDate: currentEndDate }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'sessions' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'screenPageViewsPerSession' },
        ],
      }),
      // Previous period: core metrics for comparison
      analyticsDataClient.runReport({
        property,
        dateRanges: [{ startDate: prevStartDate, endDate: prevEndDate }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'bounceRate' },
          { name: 'conversions' },
        ],
      }),
      // Top pages
      analyticsDataClient.runReport({
        property,
        dateRanges: [{ startDate: currentStartDate, endDate: currentEndDate }],
        dimensions: [{ name: 'pageTitle' }, { name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 5,
      }),
      // Traffic channels
      analyticsDataClient.runReport({
        property,
        dateRanges: [{ startDate: currentStartDate, endDate: currentEndDate }],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'totalUsers' }],
      }),
      // Device breakdown
      analyticsDataClient.runReport({
        property,
        dateRanges: [{ startDate: currentStartDate, endDate: currentEndDate }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'totalUsers' }],
      }),
      // Top countries
      analyticsDataClient.runReport({
        property,
        dateRanges: [{ startDate: currentStartDate, endDate: currentEndDate }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'totalUsers' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 3,
      }),
      // Conversions and Key Events by event name
      analyticsDataClient.runReport({
        property,
        dateRanges: [{ startDate: currentStartDate, endDate: currentEndDate }],
        dimensions: [{ name: 'eventName' }],
        metrics: [
          { name: 'conversions' },
          { name: 'eventCount' }
        ],
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 10,
      }),
    ]);

    // Parse main metrics
    const mainRow = mainResponse.rows?.[0];
    const m = (mainRow?.metricValues as any[]) || [];
    const totalUsers = m[0]?.value || '0';
    const newUsers = m[1]?.value || '0';
    const sessions = m[2]?.value || '0';
    const avgSessionDuration = formatDuration(parseFloat(m[3]?.value || '0'));
    const bounceRate = m[4]?.value ? (parseFloat(m[4].value) * 100).toFixed(1) : '0';
    const pagesPerSession = m[5]?.value ? parseFloat(m[5].value).toFixed(1) : '0';
    const returningUsers = String(parseInt(totalUsers) - parseInt(newUsers));

    // Parse previous period
    const prevRow = prevResponse.rows?.[0];
    const pm = prevRow?.metricValues || [];
    const prevTotalUsers = pm[0]?.value || '0';
    const prevBounceRate = pm[1]?.value ? (parseFloat(pm[1].value) * 100).toFixed(1) : '0';
    const prevConversionsTotal = pm[2]?.value || '0';

    // Parse top pages
    const topPages = (pagesResponse.rows || []).slice(0, 5).map(row => ({
      name: row.dimensionValues?.[0]?.value || '(unknown)',
      url: row.dimensionValues?.[1]?.value || '/',
      count: row.metricValues?.[0]?.value || '0',
    }));

    // Parse channels
    const channelMap: Record<string, string> = {};
    (channelResponse.rows || []).forEach(row => {
      const ch = row.dimensionValues?.[0]?.value || '';
      channelMap[ch] = row.metricValues?.[0]?.value || '0';
    });
    const organicSearchUsers = channelMap['Organic Search'] || '0';
    const directUsers = channelMap['Direct'] || '0';
    const socialUsers = channelMap['Organic Social'] || channelMap['Social'] || '0';
    const referralUsers = channelMap['Referral'] || '0';
    const paidUsers = channelMap['Paid Search'] || channelMap['Paid'] || '0';

    // Parse devices
    const deviceMap: Record<string, number> = {};
    let deviceTotal = 0;
    (deviceResponse.rows || []).forEach(row => {
      const dev = row.dimensionValues?.[0]?.value || '';
      const val = parseInt(row.metricValues?.[0]?.value || '0');
      deviceMap[dev] = val;
      deviceTotal += val;
    });
    const pct = (key: string) =>
      deviceTotal > 0 ? ((deviceMap[key] || 0) / deviceTotal * 100).toFixed(0) : '0';
    const desktopPct = pct('desktop');
    const mobilePct = pct('mobile');
    const tabletPct = pct('tablet');

    // Parse countries
    const topCountries = (countryResponse.rows || [])
      .map(row => `${row.dimensionValues?.[0]?.value || '?'} (${row.metricValues?.[0]?.value || '0'})`)
      .join(', ');

    // Parse conversions (using both official 'conversions' and 'eventCount' for likely success events)
    const LIKELY_CONVERSION_EVENTS = [
      'purchase', 'generate_lead', 'lead', 'sign_up', 'signup', 
      'contact', 'submit_form', 'form_submit', 'request_quote', 
      'add_to_cart', 'search_results'
    ];

    const conversions = (convResponse.rows || [])
      .map(row => {
        const eventName = row.dimensionValues?.[0]?.value || 'unknown';
        const officialConvCount = parseInt(row.metricValues?.[0]?.value || '0');
        const rawEventCount = parseInt(row.metricValues?.[1]?.value || '0');
        
        // If it's a 'likely' conversion event, use the raw count if official count is zero
        const effectiveCount = (officialConvCount > 0) 
          ? officialConvCount 
          : (LIKELY_CONVERSION_EVENTS.includes(eventName.toLowerCase()) ? rawEventCount : 0);

        return {
          eventName,
          count: String(effectiveCount),
          isOfficial: officialConvCount > 0
        };
      })
      .filter(c => {
        // Filter out noise: only show official conversions or likely successes with > 0 count
        const isNoise = ['session_start', 'first_visit', 'page_view', 'user_engagement'].includes(c.eventName);
        return !isNoise && parseInt(c.count) > 0;
      })
      .sort((a, b) => parseInt(b.count) - parseInt(a.count))
      .slice(0, 5);

    return NextResponse.json({
      propertyId,
      mock: false,
      data: {
        totalUsers,
        newUsers,
        returningUsers,
        sessions,
        avgSessionDuration,
        bounceRate,
        pagesPerSession,
        topPages,
        organicSearchUsers,
        directUsers,
        socialUsers,
        referralUsers,
        paidUsers,
        conversions,
        prevTotalUsers,
        prevBounceRate,
        prevConversionsTotal,
        desktopPct,
        mobilePct,
        tabletPct,
        topCountries,
      },
    });
  } catch (error: any) {
    console.error('GA4 Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
