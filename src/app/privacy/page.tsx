import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from '../client/[id]/report/page.module.css'; // Reusing some base structural styles for ease

export const metadata = {
  title: 'Privacy Policy | GA4 Explainer',
  description: 'Privacy Policy and Data Handling for GA4 Explainer Pro',
};

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#09090b', color: '#fafafa', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ padding: '24px 40px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center' }}>
        <Link href="/" style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', fontWeight: 500 }}>
          <ArrowLeft size={18} /> Back to Dashboard
        </Link>
      </header>

      <main style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', lineHeight: '1.6' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Privacy Policy</h1>
        <p style={{ color: '#a1a1aa', marginBottom: '32px' }}>Last Updated: April 12, 2026</p>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', borderBottom: '1px solid #27272a', paddingBottom: '8px', marginBottom: '16px' }}>1. Introduction</h2>
          <p style={{ color: '#d4d4d8' }}>
            Welcome to GA4 Explainer Pro ("we", "our", or "us"). We are committed to protecting your privacy and ensuring that your personal information is handled safely and responsibly. This Privacy Policy outlines how we process the data you trust us with, specifically regarding Google Analytics (GA4) integrations.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', borderBottom: '1px solid #27272a', paddingBottom: '8px', marginBottom: '16px' }}>2. Google User Data</h2>
          <p style={{ color: '#d4d4d8' }}>
            Our application integrates directly with the <strong>Google Analytics Data API</strong> to generate plain-English reports for your clients. 
            <br /><br />
            <strong>What we access:</strong> We access read-only metrics and dimensions from your connected GA4 properties (such as visitor traffic, page views, and session duration).<br />
            <strong>How we use it:</strong> This data is strictly transmitted to our AI summarization engine (Google Gemini) purely for the purpose of generating your requested PDF report. <br />
            <strong>Data Sharing:</strong> We <strong>DO NOT</strong> sell, rent, or distribute your Google Analytics data to third-party brokers under any circumstances.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', borderBottom: '1px solid #27272a', paddingBottom: '8px', marginBottom: '16px' }}>3. Data Storage</h2>
          <p style={{ color: '#d4d4d8' }}>
            To provide our service, we store basic client mappings (such as Client Name and their associated GA4 Property ID) in our securely encrypted database infrastructure (Supabase). The actual raw analytics traffic data pulled during report generation is processed in memory and immediately discarded. It is not permanently stored on our servers.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', borderBottom: '1px solid #27272a', paddingBottom: '8px', marginBottom: '16px' }}>4. AI Processing</h2>
          <p style={{ color: '#d4d4d8' }}>
            In order to generate "plain English" summaries, aggregated metrics are passed to an AI Large Language Model. The data provided is minimized and does not include Personally Identifiable Information (PII) of your end-website visitors.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', borderBottom: '1px solid #27272a', paddingBottom: '8px', marginBottom: '16px' }}>5. Contact Us</h2>
          <p style={{ color: '#d4d4d8' }}>
            If you have any questions or concerns regarding this Privacy Policy, or if you would like to request the deletion of your account and associated data, please contact us at <strong>privacy@ga4explainer.com</strong>.
          </p>
        </section>
      </main>
    </div>
  );
}
