"use client";

import Link from 'next/link';
import { ChevronLeft, Zap, FileText, TrendingUp, Users, Target, CheckCircle } from 'lucide-react';

export default function SampleReport() {
  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', color: 'white', padding: '40px 20px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <Link href="/" style={{ color: '#a1a1aa', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <ChevronLeft size={16} /> Back to Home
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7c3aed', fontWeight: '700' }}>
            <Zap size={20} /> GA4 Explainer
          </div>
        </div>

        {/* Report Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e1e1e 0%, #121212 100%)', padding: '40px', borderRadius: '24px', border: '1px solid #27272a', marginBottom: '32px', textAlign: 'center' }}>
          <div style={{ background: '#7c3aed15', color: '#7c3aed', padding: '6px 16px', borderRadius: '99px', fontSize: '12px', fontWeight: '700', display: 'inline-block', marginBottom: '16px' }}>
            SAMPLE REPORT (DEMO)
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '12px' }}>Monthly Performance Summary</h1>
          <p style={{ color: '#a1a1aa', fontSize: '16px' }}>For: **Demo Agency / Acme Corp** • March 2026</p>
        </div>

        {/* Metrics Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
          <div style={{ background: '#1e1e1e', padding: '24px', borderRadius: '20px', border: '1px solid #27272a' }}>
            <p style={{ color: '#a1a1aa', fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>TOTAL USERS</p>
            <h2 style={{ fontSize: '24px', fontWeight: '700' }}>12,450 <span style={{ color: '#10b981', fontSize: '14px' }}>+12%</span></h2>
          </div>
          <div style={{ background: '#1e1e1e', padding: '24px', borderRadius: '20px', border: '1px solid #27272a' }}>
            <p style={{ color: '#a1a1aa', fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>CONVERSIONS</p>
            <h2 style={{ fontSize: '24px', fontWeight: '700' }}>842 <span style={{ color: '#10b981', fontSize: '14px' }}>+8%</span></h2>
          </div>
          <div style={{ background: '#1e1e1e', padding: '24px', borderRadius: '20px', border: '1px solid #27272a' }}>
            <p style={{ color: '#a1a1aa', fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>REVENUE</p>
            <h2 style={{ fontSize: '24px', fontWeight: '700' }}>$4,120 <span style={{ color: '#ef4444', fontSize: '14px' }}>-2%</span></h2>
          </div>
        </div>

        {/* AI Content Section */}
        <div style={{ background: '#1e1e1e', padding: '40px', borderRadius: '24px', border: '1px solid #27272a', lineHeight: '1.7' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '24px', borderBottom: '1px solid #27272a', paddingBottom: '12px' }}>Executive Summary</h3>
          
          <p style={{ marginBottom: '20px', color: '#e4e4e7' }}>
            This month saw a **significant spike in overall traffic (12%)**, largely driven by your recent LinkedIn campaign. While quantity of users is up, we are seeing a slight drop in revenue per user.
          </p>

          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#7c3aed', marginBottom: '16px', marginTop: '32px' }}>What is working:</h3>
          <ul style={{ paddingLeft: '20px', color: '#e4e4e7', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <li>**Organic Search**: SEO traffic is steady, contributing 40% of all conversions.</li>
            <li>**User Engagement**: Time on page increased by **45 seconds** on the pricing page.</li>
            <li>**Mobile Conversion**: Mobile users are converting 15% better than last month.</li>
          </ul>

          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#7c3aed', marginBottom: '16px', marginTop: '32px' }}>Recommendations:</h3>
          <p style={{ color: '#e4e4e7' }}>
            Focus on increasing the conversion rate of those new LinkedIn users. I recommend a **custom landing page** specifically for traffic coming from social channels to better match their intent.
          </p>
        </div>

        {/* Footer CTA */}
        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <p style={{ color: '#a1a1aa', marginBottom: '20px' }}>Want reports like this for your own clients?</p>
          <Link href="/" style={{ background: '#7c3aed', color: 'white', padding: '12px 32px', borderRadius: '12px', fontWeight: '700', textDecoration: 'none', display: 'inline-block' }}>
            Try GA4 Explainer for Free
          </Link>
        </div>
      </div>
    </main>
  );
}
