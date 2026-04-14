"use client";

import { useState, useEffect, useCallback } from 'react';
import { Download, ArrowLeft, Loader2, RefreshCw, CheckCircle, AlertCircle, MinusCircle, TrendingUp, Users, Clock, MousePointerClick, Globe, Smartphone, Monitor, Tablet } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { use } from 'react';
import { supabase } from '@/lib/supabase';
import type { ParsedReport } from '@/lib/prompts';
import { useReportStatus } from '@/hooks/useReportStatus';
import ReactMarkdown from 'react-markdown';
import styles from './page.module.css';

const DATE_RANGES = [
  { label: 'Last 7 Days', value: '7' },
  { label: 'Last 30 Days', value: '30' },
  { label: 'Last 90 Days', value: '90' },
];

const DID_YOU_KNOW_TIPS = [
  "Did you know? Removing 1 field from your contact form can increase conversions by 26%.",
  "Did you know? 53% of mobile users leave a site if it takes longer than 3 seconds to load.",
  "Did you know? Video on a landing page can increase conversions by up to 80%.",
  "Did you know? Calls to action in red often outperform green buttons.",
  "Did you know? Clear headings improve conversion rates by 42% on average."
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
  const { data: session, status } = useSession();
  const clientName = searchParams.get('name') || 'Client';
  const clientId = searchParams.get('clientId') || null;
  const propertyId = decodeURIComponent(resolvedParams.id);

  const [loading, setLoading] = useState(true);
  const [isUpdatingDate, setIsUpdatingDate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30');

  const [reportData, setReportData] = useState<FullReportData | null>(null);
  const [rawStatsData, setRawStatsData] = useState<any>(null);

  const [reportId, setReportId] = useState<string | null>(null);
  const [marketingTip, setMarketingTip] = useState(DID_YOU_KNOW_TIPS[0]);

  // Hook handles all polling!
  const { status: pollStatus, progress, data: parsedReport, error: pollError } = useReportStatus(reportId);

  // Redirect if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/');
  }, [status, router]);

  const loadReport = useCallback(async (range: string, isOverlay: boolean = false) => {
    if (!isOverlay) {
      setLoading(true);
      setRawStatsData(null);
      setReportData(null);
    }
    setError(null);
    setReportId(null);
    try {
      // Queue AI report via backend. GA4 fetch is now securely handled by the background worker!
      const aiRes = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          propertyId,
          dateRange: range,
        }),
      });
      if (!aiRes.ok) throw new Error('Failed to start report generation');
      const startJson = await aiRes.json();

      if (startJson.error) throw new Error(startJson.error);

      // 3. Kick off polling by setting reportId
      setReportId(startJson.reportId);

    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  }, [propertyId, clientName]);

  // Handle completed or failed polling status from hook
  useEffect(() => {
    if (!reportId) return; // Fix: Prevent processing old cached data before the hook drops it when re-fetching

    if (pollStatus === 'completed' && parsedReport) { // parsedReport now contains { stats, report } from Worker
      const finalReport = parsedReport.report ? { ...parsedReport.report } : { ...parsedReport };
      const rawStats = parsedReport.stats || {};

      if (finalReport.__model_used) {
        console.log(`✅ Report Generated Successfully!`);
        console.log(`🤖 Model Engine Used: ${finalReport.__model_used}`);
        delete finalReport.__model_used;
      }

      setReportData({
        clientName,
        propertyId,
        dateRange,
        stats: rawStats,
        report: finalReport,
      });

      setLoading(false);
      setIsUpdatingDate(false);

      // ── Update "Last Report" timestamp in Database ──────────────────
      if (clientId) {
        const now = new Date().toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit',
        });
        supabase
          .from('clients')
          .update({
            last_report: now,
            has_generated_report: true
          })
          .eq('id', clientId)
          .then(() => { });
      }
    } else if (pollStatus === 'failed' || pollError) {
      setError(pollError || 'Servers are currently busy. Please try again in a few minutes.');
      setLoading(false);
      setIsUpdatingDate(false);
    }
  }, [pollStatus, parsedReport, pollError, clientId, clientName, propertyId, dateRange]);

  // Shuffle marketing tip when AI goes into analyzing phase!
  useEffect(() => {
    if (pollStatus === 'analyzing') {
      const randomTip = DID_YOU_KNOW_TIPS[Math.floor(Math.random() * DID_YOU_KNOW_TIPS.length)];
      setMarketingTip(randomTip);
    }
  }, [pollStatus]);

  useEffect(() => {
    loadReport(dateRange);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRangeChange = (newRange: string) => {
    if (newRange === dateRange) return;
    setDateRange(newRange);
    setIsUpdatingDate(true);
    loadReport(newRange, true);
  };

  const handleDownloadPDF = async () => {
    const html2canvas = (await import('html2canvas')).default;
    const { jsPDF } = await import('jspdf');
    const element = document.getElementById('report-content');
    if (!element) return;

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const totalImgHeight = (canvas.height * pageWidth) / canvas.width;

    let remainingHeight = totalImgHeight;
    let yOffset = 0;
    let isFirstPage = true;

    while (remainingHeight > 0) {
      if (!isFirstPage) pdf.addPage();

      const sliceHeightMm = Math.min(remainingHeight, pageHeight);
      pdf.addImage(imgData, 'PNG', 0, -(yOffset), pageWidth, totalImgHeight);

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
              disabled={loading || isUpdatingDate}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => loadReport(dateRange)} disabled={loading || isUpdatingDate} title="Regenerate">
            <RefreshCw size={16} className={loading || isUpdatingDate ? styles.spinning : ''} />
          </button>
          <button className="btn-primary" onClick={handleDownloadPDF} disabled={loading || isUpdatingDate || !reportData}>
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>

      {/* Loading State via useReportStatus Hook */}
      {loading && (
        <div className={styles.loadingState}>
          <Loader2 size={36} className={styles.spinning} />
          <h3>Analysing GA4 Data…</h3>
          <p>
            {pollStatus === 'pending' ? 'Step 1/3: Preparing your data...'
              : pollStatus === 'simplifying' ? 'Step 1/3: Condensing metrics...'
                : pollStatus === 'analyzing' ? 'Step 2/3: AI is finding insights...'
                  : pollStatus === 'completed' ? 'Step 3/3: Finalizing Report!'
                    : 'Initializing...'}
          </p>

          {/* Progress Bar Container */}
          <div style={{ width: '100%', maxWidth: '300px', height: '6px', background: '#e5e7eb', borderRadius: '4px', marginTop: '16px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#4f46e5', transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
          </div>

          {/* Marketing Tip while Analyzing */}
          {pollStatus === 'analyzing' && (
            <div style={{ marginTop: '24px', fontStyle: 'italic', color: 'var(--foreground)', fontSize: '13.5px', maxWidth: '400px', textAlign: 'center', background: 'var(--card-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              💡 {marketingTip}
            </div>
          )}
        </div>
      )}

      {/* Updating Overlay Modal */}
      {isUpdatingDate && (
        <div className={styles.modalOverlay} style={{ zIndex: 999 }}>
          <div className={styles.modal} style={{ maxWidth: '340px', textAlign: 'center', padding: '32px' }}>
            <Loader2 size={36} className={styles.spinning} style={{ color: 'var(--primary)', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px' }}>Updating Timeframe</h3>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '16px' }}>
              AI is analyzing data for the last {dateRange} days... 
            </p>
            <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '12px', fontStyle: 'italic' }}>
              {pollStatus === 'simplifying' ? 'Condensing metrics...' :
               pollStatus === 'analyzing' ? 'Consulting Multi-Model Engine...' :
               pollStatus === 'completed' ? 'Finalizing Report...' : 'Connecting to Google Analytics...'}
            </p>
          </div>
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
              <h1 className={styles.reportTitle}>{reportData.report.meta?.report_title || 'Performance Update'}</h1>
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
            <p className={styles.summaryText}>{reportData.report.executive_summary.text}</p>
            {reportData.report.executive_summary.key_metric_label && (
              <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px', display: 'inline-block', fontWeight: 500, color: '#4f46e5' }}>
                Key Metric ({reportData.report.executive_summary.key_metric_label}): {reportData.report.executive_summary.key_metric_value}
              </div>
            )}
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

          {/* AI Highlights & Analysis Sections */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>What the data says</h2>
            <div className={styles.highlightsGrid}>
              {reportData.report.analysis_sections.map((h, i) => (
                <div key={i} className={`${styles.highlight} ${sentimentClass(h.sentiment)}`}>
                  <div className={styles.highlightTitle}>
                    {sentimentIcon(h.sentiment)}
                    {h.heading}
                  </div>
                  <div className={styles.highlightInsight}>
                    <ReactMarkdown>{h.body_markdown}</ReactMarkdown>
                  </div>
                  {h.visual_tip && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', fontStyle: 'italic' }}>
                      📸 Tip for PDF: {h.visual_tip}
                    </div>
                  )}
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

          {/* Strategic Roadmap */}
          <div className={`${styles.section} ${styles.recommendationsSection}`}>
            <h2 className={styles.sectionTitle}>Strategic Roadmap</h2>
            <div className={styles.recommendations}>
              {reportData.report.strategic_roadmap.map((rec, i) => (
                <div key={i} className={styles.recommendation}>
                  <div className={styles.recNumber}>{i + 1}</div>
                  <div>
                    <div className={styles.recAction} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {rec.task}
                      <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: rec.priority.toLowerCase().includes('high') ? '#fee2e2' : '#f3f4f6', color: rec.priority.toLowerCase().includes('high') ? '#ef4444' : '#4b5563' }}>
                        {rec.priority}
                      </span>
                    </div>
                    <div className={styles.recReason}>{rec.expected_impact}</div>
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
