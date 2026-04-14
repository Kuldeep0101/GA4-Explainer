"use client";

import Link from 'next/link';
import { Check, ArrowRight, Zap, Shield, RefreshCw, Smartphone } from 'lucide-react';
import { signIn, useSession } from 'next-auth/react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import styles from './page.module.css';

export default function PricingPage() {
  const { data: session } = useSession();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleAction = async (plan: 'starter' | 'agency' | 'free') => {
    if (!session) {
      // If not logged in, send them to sign in
      signIn('google', { callbackUrl: plan === 'free' ? '/' : `/pricing?upgrade=${plan}` });
      return;
    }

    if (plan === 'free') {
      window.location.href = '/';
      return;
    }

    // If logged in, initiate checkout
    setLoadingPlan(plan);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Checkout failed');
      }
    } catch (err) {
      toast.error('Network error');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className={styles.pricingPage}>
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <Link href="/" className={styles.logo}>
            <Zap size={20} />
            GA4 Explainer
          </Link>
        </div>
        
        <div className={styles.header}>
          <h1 className={styles.title}>Simple, Agency-First Pricing</h1>
          <p className={styles.subtitle}>Stop wasting hours on reporting. Choose the plan that fits your growth.</p>
        </div>

        <div className={styles.grid}>
          {/* Starter Plan */}
          <div className={styles.pricingCard}>
            <div className={styles.planName}>Starter</div>
            <div className={styles.price}>
              ₹2,999<span className={styles.priceSubtext}>/mo</span>
            </div>
            <ul className={styles.featureList}>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> 5 Clients included</li>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> Unlimited AI Reports</li>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> One-Click PDF Exports</li>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> custom Date Ranges</li>
              <li className={styles.featureItem} style={{ color: 'var(--muted)', opacity: 0.6 }}><Check size={18} /> White-label reports</li>
            </ul>
            <button 
              className={`${styles.cta} ${styles.ctaOutline}`}
              onClick={() => handleAction('starter')}
              disabled={!!loadingPlan}
            >
              {loadingPlan === 'starter' ? 'Loading...' : 'Buy Starter'}
            </button>
          </div>

          {/* Free Trial (Featured) */}
          <div className={`${styles.pricingCard} ${styles.featuredCard}`}>
            <div className={styles.badge}>Most Popular</div>
            <div className={styles.planName} style={{ color: 'var(--primary)' }}>Free Trial</div>
            <div className={styles.price}>
              ₹0<span className={styles.priceSubtext}> for 7 days</span>
            </div>
            <ul className={styles.featureList}>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> 2 Trial Clients</li>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> Unlimited AI Reports</li>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> One-Click PDF Exports</li>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> No Credit Card Required</li>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> Full Feature Access</li>
            </ul>
            <button 
              className={`${styles.cta} ${styles.ctaFill}`}
              onClick={() => handleAction('free')}
            >
              Start Free Trial <ArrowRight size={18} />
            </button>
          </div>

          {/* Agency Plan */}
          <div className={styles.pricingCard}>
            <div className={styles.planName}>Agency</div>
            <div className={styles.price}>
              ₹5,999<span className={styles.priceSubtext}>/mo</span>
            </div>
            <ul className={styles.featureList}>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> Unlimited Clients</li>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> Unlimited AI Reports</li>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> One-Click PDF Exports</li>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> White-label reports</li>
              <li className={styles.featureItem}><Check size={18} color="#16a34a" /> Priority AI Support</li>
            </ul>
            <button 
              className={`${styles.cta} ${styles.ctaOutline}`}
              onClick={() => handleAction('agency')}
              disabled={!!loadingPlan}
            >
              {loadingPlan === 'agency' ? 'Loading...' : 'Buy Agency'}
            </button>
          </div>
        </div>

        <div className={styles.footerNote}>
          <p>All plans include a 7-day free trial. No credit card required to start.</p>
        </div>

        {/* FAQ Section */}
        <div className={styles.faqSection}>
          <div className={styles.faqHeader}>
            <h2 className={styles.faqTitle}>Frequently Asked Questions</h2>
          </div>
          <div className={styles.faqGrid}>
            <div className={styles.faqItem}>
              <h3><RefreshCw size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} color="var(--primary)" /> What happens when my trial ends?</h3>
              <p>Your account pauses. Your client data is saved securely for 30 days so you can pick up exactly where you left off when you're ready to upgrade.</p>
            </div>
            <div className={styles.faqItem}>
              <h3><Zap size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} color="var(--primary)" /> Can I switch plans later?</h3>
              <p>Yes, you can upgrade to Agency or downgrade to Starter at any time from your account settings. Payments are prorated automatically.</p>
            </div>
            <div className={styles.faqItem}>
              <h3><Smartphone size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} color="var(--primary)" /> Do you support UPI?</h3>
              <p>Yes. Through our partner Dodo Payments, Indian agencies can pay via UPI, Google Pay, PhonePe, or any major credit/debit card.</p>
            </div>
            <div className={styles.faqItem}>
              <h3><Shield size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} color="var(--primary)" /> Is my clients&apos; GA4 data secure?</h3>
              <p>We request read-only access to your GA4 properties. We never modify your data, and we do not store raw analytics records on our servers — only the AI-generated summaries.</p>
            </div>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '80px' }}>
             <Link href="/" style={{ color: 'var(--muted)', fontSize: '15px', fontWeight: '500', textDecoration: 'underline' }}>Back to Dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
