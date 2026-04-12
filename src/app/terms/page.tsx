import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service | GA4 Explainer',
  description: 'Terms of Service for GA4 Explainer Pro',
};

export default function TermsOfService() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#09090b', color: '#fafafa', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ padding: '24px 40px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center' }}>
        <Link href="/" style={{ color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', fontWeight: 500 }}>
          <ArrowLeft size={18} /> Back to Dashboard
        </Link>
      </header>

      <main style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', lineHeight: '1.6' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>Terms of Service</h1>
        <p style={{ color: '#a1a1aa', marginBottom: '32px' }}>Last Updated: April 12, 2026</p>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', borderBottom: '1px solid #27272a', paddingBottom: '8px', marginBottom: '16px' }}>1. Acceptance of Terms</h2>
          <p style={{ color: '#d4d4d8' }}>
            By accessing or using GA4 Explainer Pro, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', borderBottom: '1px solid #27272a', paddingBottom: '8px', marginBottom: '16px' }}>2. Use License and APIs</h2>
          <p style={{ color: '#d4d4d8' }}>
            Our application integrates with the Google Analytics API. You grant us permission to securely fetch your connected propertys' read-only analytics data strictly for the purpose of generating automated AI reports. You may not use the service for any illegal or unauthorized purpose.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', borderBottom: '1px solid #27272a', paddingBottom: '8px', marginBottom: '16px' }}>3. Service Availability and Generated Content</h2>
          <p style={{ color: '#d4d4d8' }}>
            While we strive for 100% uptime, the service relies on third-party APIs (Google Analytics API, AI LLM Providers). We are not strictly liable for temporary downtimes caused by these upstream providers. Generated reports are produced using AI models and are subject to occasional "hallucinations" or inaccuracies; you are expected to review reports prior to forwarding them to end-clients.
          </p>
        </section>

        <section style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '20px', borderBottom: '1px solid #27272a', paddingBottom: '8px', marginBottom: '16px' }}>4. Termination</h2>
          <p style={{ color: '#d4d4d8' }}>
            We may terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
          </p>
        </section>
      </main>
    </div>
  );
}
