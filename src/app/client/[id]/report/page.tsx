"use client";

import { useState, useEffect, useCallback } from 'react';
import { Download, ArrowLeft, Loader2, RefreshCw, CheckCircle, AlertCircle, MinusCircle, TrendingUp, Users, Clock, MousePointerClick, Globe, Smartphone, Monitor, Tablet } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { use } from 'react';
import { supabase } from '@/lib/supabase';
import type { ParsedReport } from '@/lib/prompts';
import styles from './page.module.css';

const DATE_RANGES = [
  { label: 'Last 7 Days', value: '7' },
  { label: 'Last 30 Days', value: '30' },
  { label: 'Last 90 Days', value: '90' },
];

interface FullReportData {
  clientName: string;
  propertyId: string;
  dateRange: string;
  stats: any;
  report: ParsedReport;
}

export default function ClientReport({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const clientName = searchParams.get('name') || 'Client';
  const clientId = searchParams.get('clientId') || null;
  const propertyId = decodeURIComponent(resolvedParams.id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30');
  const [reportData, setReportData] = useState<FullReportData | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  const loadReport = useCallback(async (range: string) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch GA4 stats
      const ga4Res = await fetch(`/api/ga4?propertyId=${propertyId}&dateRange=${range}`);
      if (!ga4Res.ok) throw new Error('Failed to fetch GA4 data');
      const ga4Json = await ga4Res.json();

      // 2. Generate AI report
      const aiRes = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          stats: ga4Json.data,
          dateRange: range,
        }),
      });
      if (!aiRes.ok) throw new Error('Failed to generate report');
      const aiJson = await aiRes.json();

      if (aiJson.error) throw new Error(aiJson.error);

      // Successfully log the specific AI model used in the browser console
      console.log(`✅ Report Generated Successfully!`);
      console.log(`🤖 Model Engine Used: ${aiJson.model}`);

      setReportData({
        clientName,
        propertyId,
        dateRange: range,
        stats: ga4Json.data,
        report: aiJson.report,
      });

      // ── Update "Last Report" timestamp in Database ──────────────────
      if (clientId) {
        const now = new Date().toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        });
        await supabase
          .from('clients')
          .update({ last_report: now })
          .eq('id', clientId);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [propertyId, clientName]);

  useEffect(() => {
    loadReport(dateRange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRangeChange = (newRange: string) => {
    setDateRange(newRange);
    loadReport(newRange);
  };

  const handleDownloadPDF = async () => {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const element = document.getElementById('report-content');
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      // Expand to full scroll height so nothing is clipped
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();   // 210mm
    const pageHeight = pdf.internal.pageSize.getHeight();  // 297mm

    // Total rendered height in mm
    const totalImgHeight = (canvas.height * pageWidth) / canvas.width;

    let remainingHeight = totalImgHeight;
    let yOffset = 0;         // how far down the image we've printed (mm)
    let isFirstPage = true;

    while (remainingHeight > 0) {
      if (!isFirstPage) pdf.addPage();

      // srcY in canvas pixels corresponding to current yOffset mm
      const srcYpx = (yOffset / totalImgHeight) * canvas.height;
      // How many mm of image fit on this page
      const sliceHeightMm = Math.min(remainingHeight, pageHeight);
      // Corresponding canvas pixel height for this slice
      const sliceHeightPx = (sliceHeightMm / totalImgHeight) * canvas.height;

      // Draw the full-width image shifted upward so only this slice is visible
      pdf.addImage(
        imgData,
        'PNG',
        0,
        -(yOffset),          // shift image up by how many mm we've already printed
        pageWidth,
        totalImgHeight,       // full image height — jsPDF clips to page boundary
      );

      yOffset += sliceHeightMm;
      remainingHeight -= sliceHeightMm;
      isFirstPage = false;
    }

    pdf.save(`${clientName.replace(/\s+/g, '_')}_GA4_Report.pdf`);
  };

  const sentimentIcon = (s: string) => {
    if (s === 'positive') return <CheckCircle size={16} />;
    if (s === 'negative') return <AlertCircle size={16} />;
    return <MinusCircle size={16} />;
  };

  const sentimentClass = (s: string) => {
    if (s === 'positive') return styles.positive;
    if (s === 'negative') return styles.negative;
    return styles.neutral;
  };

  return (
    <div className={styles.page}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <Link href="/" className="btn-secondary">
          <ArrowLeft size={16} /> Back
        </Link>

        <div className={styles.rangeSelector}>
          {DATE_RANGES.map(r => (
            <button
              key={r.value}
              className={`${styles.rangeBtn} ${dateRange === r.value ? styles.rangeActive : ''}`}
              onClick={() => handleRangeChange(r.value)}
              disabled={loading}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => loadReport(dateRange)} disabled={loading} title="Regenerate">
            <RefreshCw size={16} className={loading ? styles.spinning : ''} />
          </button>
          <button className="btn-primary" onClick={handleDownloadPDF} disabled={loading || !reportData}>
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className={styles.loadingState}>
          <Loader2 size={36} className={styles.spinning} />
          <h3>Analysing GA4 Data…</h3>
          <p>Pulling metrics and generating your plain-English report with Gemini AI</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className={styles.errorState}>
          <AlertCircle size={32} />
          <h3>Report failed to load</h3>
          <p className={styles.errorText}>{error}</p>

          <div className={styles.troubleshootingBox}>
            <h4>Troubleshooting Checklist</h4>
            <ul>
              <li>
                <strong>Check Property ID:</strong> Is <code style={{ background: 'rgba(0,0,0,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{propertyId}</code> the correct 9-digit Google Analytics Property ID? <a href="https://analytics.google.com/" target="_blank" rel="noreferrer" style={{ color: '#6366f1', textDecoration: 'underline' }}>Open Analytics</a>
              </li>
              <li>
                <strong>Enable API:</strong> Is the Google Analytics Data API enabled in your Google Cloud Project? <a href="https://console.cloud.google.com/apis/api/analyticsdata.googleapis.com/metrics" target="_blank" rel="noreferrer" style={{ color: '#6366f1', textDecoration: 'underline' }}>Check Google Cloud</a>
              </li>
              <li>
                <strong>Add Service Account:</strong> Have you added your Service Account email as a "Viewer" directly inside the GA4 Property Access Management?
              </li>
            </ul>
          </div>

          <button className="btn-primary" onClick={() => loadReport(dateRange)} style={{ marginTop: '16px' }}>Try Again</button>
        </div>
      )}

      {/* Report */}
      {!loading && !error && reportData && (
        <div id="report-content" className={styles.reportContainer}>

          {/* Report Header */}
          <div className={styles.reportHeader}>
            <div>
              <div className={styles.reportBadge}>GA4 Performance Report</div>
              <h1 className={styles.reportTitle}>Performance Update</h1>
              <p className={styles.reportPeriod}>{reportData.report.report_date_range}</p>
            </div>
            <div className={styles.reportClientBlock}>
              <div className={styles.reportAvatar}>{clientName.charAt(0).toUpperCase()}</div>
              <div>
                <div className={styles.reportClientName}>{clientName}</div>
                <div className={styles.reportPropertyId}>Property: {propertyId}</div>
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div className={styles.summaryBlock}>
            <p className={styles.summaryText}>{reportData.report.summary}</p>
          </div>

          {/* Stat Cards */}
          <div className={styles.statsGrid}>
            <StatCard icon={<Users size={18} />} label="Total Visitors" value={reportData.stats.totalUsers} sub={`${reportData.stats.newUsers} new`} />
            <StatCard icon={<TrendingUp size={18} />} label="Sessions" value={reportData.stats.sessions} sub={`${reportData.stats.pagesPerSession} pages/session`} />
            <StatCard icon={<Clock size={18} />} label="Avg. Session" value={`${Math.floor(parseInt(reportData.stats.avgSessionDuration || '0') / 60)}m ${parseInt(reportData.stats.avgSessionDuration || '0') % 60}s`} sub="time on site" />
            <StatCard icon={<MousePointerClick size={18} />} label="Conversions" value={reportData.stats.conversions?.reduce((sum: number, c: any) => sum + parseInt(c.count || '0'), 0).toString() || '0'} sub="key actions taken" />
          </div>

          {/* Device Breakdown */}
          {reportData.stats.desktopPct && (
            <div className={styles.deviceRow}>
              <DeviceBar icon={<Monitor size={14} />} label="Desktop" pct={reportData.stats.desktopPct} />
              <DeviceBar icon={<Smartphone size={14} />} label="Mobile" pct={reportData.stats.mobilePct} />
              <DeviceBar icon={<Tablet size={14} />} label="Tablet" pct={reportData.stats.tabletPct} />
            </div>
          )}

          {/* AI Highlights */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>What the data says</h2>
            <div className={styles.highlightsGrid}>
              {reportData.report.highlights.map((h, i) => (
                <div key={i} className={`${styles.highlight} ${sentimentClass(h.sentiment)}`}>
                  <div className={styles.highlightTitle}>
                    {sentimentIcon(h.sentiment)}
                    {h.title}
                  </div>
                  <p className={styles.highlightInsight}>{h.insight}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Traffic Sources */}
          {reportData.stats.organicSearchUsers && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Where visitors came from</h2>
              <div className={styles.sourcesGrid}>
                {[
                  { label: 'Google Search', value: reportData.stats.organicSearchUsers },
                  { label: 'Direct', value: reportData.stats.directUsers },
                  { label: 'Social Media', value: reportData.stats.socialUsers },
                  { label: 'Referral', value: reportData.stats.referralUsers },
                  { label: 'Paid Ads', value: reportData.stats.paidUsers },
                ].filter(s => parseInt(s.value) > 0).map((source, i) => (
                  <div key={i} className={styles.sourceItem}>
                    <Globe size={14} />
                    <span className={styles.sourceLabel}>{source.label}</span>
                    <span className={styles.sourceValue}>{parseInt(source.value).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Pages */}
          {reportData.stats.topPages?.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Most visited pages</h2>
              <div className={styles.pagesTable}>
                {reportData.stats.topPages.map((page: any, i: number) => (
                  <div key={i} className={styles.pageRow}>
                    <span className={styles.pageRank}>{i + 1}</span>
                    <span className={styles.pageName}>{page.name}</span>
                    <code className={styles.pageUrl}>{page.url}</code>
                    <span className={styles.pageViews}>{parseInt(page.count).toLocaleString()} views</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className={`${styles.section} ${styles.recommendationsSection}`}>
            <h2 className={styles.sectionTitle}>Recommended actions this month</h2>
            <div className={styles.recommendations}>
              {reportData.report.recommendations.map((rec, i) => (
                <div key={i} className={styles.recommendation}>
                  <div className={styles.recNumber}>{i + 1}</div>
                  <div>
                    <div className={styles.recAction}>{rec.action}</div>
                    <div className={styles.recReason}>{rec.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className={styles.reportFooter}>
            <span>Generated by GA4 Explainer · Powered by AI</span>
            <span>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
      )}

    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon}>{icon}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statSub}>{sub}</div>
    </div>
  );
}

function DeviceBar({ icon, label, pct }: { icon: React.ReactNode; label: string; pct: string }) {
  return (
    <div className={styles.deviceItem}>
      <div className={styles.deviceLabel}>{icon} {label}</div>
      <div className={styles.deviceBar}>
        <div className={styles.deviceFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.devicePct}>{pct}%</div>
    </div>
  );
}
