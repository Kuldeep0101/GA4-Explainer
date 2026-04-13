"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, FileText, X, Users, TrendingUp, Zap, LogOut, LogIn, CheckCircle, Clock } from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/ThemeToggle';
import styles from './page.module.css';

interface Client {
  id: string;
  name: string;
  propertyId: string;
  lastReport: string;
  hasGeneratedReport: boolean;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientProp, setNewClientProp] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [userPlan, setUserPlan] = useState<'free' | 'starter' | 'agency'>('free'); // Multi-tier support
  const [trialDaysRemaining, setTrialDaysRemaining] = useState<number | null>(null);
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [archivedClients, setArchivedClients] = useState<any[]>([]);
  const [usedSlotsList, setUsedSlotsList] = useState<{name: string, id: string}[]>([]);

  // ── Database Sync (Supabase) ───────────────────────────
  useEffect(() => {
    if (!session?.user?.email) return;

    const syncUserAndClients = async () => {
      const email = session?.user?.email;
      if (!email) return;

      // 1. Sync User / Verify Pro Status
      let { data: userRow } = await supabase.from('users').select('*').eq('email', email).single();

      // If user doesn't exist, create them
      if (!userRow) {
        const { data: newUser } = await supabase.from('users').insert([{ email, is_pro: false }]).select().single();
        userRow = newUser;
      }

      if (userRow?.is_pro) {
        setIsPro(true);
        setUserPlan(userRow?.plan || 'starter');
      } else if (typeof window !== 'undefined' && window.location.search.includes('success=true')) {
        // Optimistic UI for instant return from Dodo Payments (before webhook fires)
        setIsPro(true);
        const urlParams = new URLSearchParams(window.location.search);
        const planParam = urlParams.get('plan') as 'starter' | 'agency' || 'starter';
        setUserPlan(planParam);
        window.history.replaceState(null, '', window.location.pathname);
      }
      
      // 2. Trial Calculation (7 Days from created_at)
      if (userRow?.created_at) {
        const createdDate = new Date(userRow.created_at);
        const trialEndDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        const diffDays = Math.max(0, Math.ceil((trialEndDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
        setTrialDaysRemaining(diffDays);
      }

      // 3. Fetch Active Clients for this user
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .eq('user_email', email)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (clientsData && clientsData.length > 0) {
        const mappedClients: Client[] = clientsData.map(c => ({
          id: c.id,
          name: c.name,
          propertyId: c.property_id,
          lastReport: c.last_report || 'Never',
          hasGeneratedReport: c.has_generated_report || false
        }));
        setClients(mappedClients);
      } else {
        // Seed with demo client for brand new users
        const demoClient = {
          user_email: email,
          name: 'Demo Agency',
          property_id: '123456789',
          last_report: 'Never'
        };
        const { data: insertedDemo } = await supabase.from('clients').insert([demoClient]).select();
        if (insertedDemo) {
          setClients([{
            id: insertedDemo[0].id,
            name: insertedDemo[0].name,
            propertyId: insertedDemo[0].property_id,
            lastReport: insertedDemo[0].last_report,
            hasGeneratedReport: false
          }]);
        }
      }

      // 4. Fetch Archived (Soft-deleted) Clients that have reports
      const { data: archived } = await supabase
        .from('clients')
        .select('*')
        .eq('user_email', email)
        .eq('is_deleted', true)
        .eq('has_generated_report', true);
      
      setArchivedClients(archived || []);

      // 5. Calculate unique slots for the modal (Identity Lock)
      const { data: allProps } = await supabase
        .from('clients')
        .select('property_id, name')
        .eq('user_email', email)
        .eq('has_generated_report', true);
      
      // Get unique IDs only
      const uniqueMap = new Map();
      allProps?.forEach(p => uniqueMap.set(p.property_id, p.name));
      
      const uniqueList = Array.from(uniqueMap.entries()).map(([id, name]) => ({
        id,
        name: name || id
      }));
      setUsedSlotsList(uniqueList);

      setMounted(true);
    };

    syncUserAndClients();
  }, [session?.user?.email]);

  const confirmDelete = async () => {
    if (!deleteId) return;
    // Optimistic UI
    setClients(clients.filter(c => c.id !== deleteId));
    setDeleteId(null);
    // Delete from Database
    await supabase.from('clients').delete().eq('id', deleteId);
  };

  const handleUpgrade = async (plan: 'starter' | 'agency') => {
    setIsCheckoutLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }) // Pass the specific tier
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to initiate checkout.');
      }
    } catch (err) {
      alert('Network error while initiating checkout.');
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email) return;
    const email = session.user.email;
    const cleanPropId = newClientProp.replace('properties/', '').trim();

    // Identity-Based Slot Logic
    const { data: allUsedProps } = await supabase
      .from('clients')
      .select('property_id, is_deleted, has_generated_report')
      .eq('user_email', email);
    
    const uniqueUsedIds = new Set(allUsedProps?.filter(c => !c.is_deleted || c.has_generated_report).map(c => c.property_id));
    const isAlreadyInSystem = allUsedProps?.find(c => c.property_id === cleanPropId);

    const limit = userPlan === 'agency' ? 999999 : (userPlan === 'starter' ? 5 : 2);
    
    if (!isAlreadyInSystem && uniqueUsedIds.size >= limit) {
      setIsModalOpen(false);
      if (userPlan === 'free') setIsTrialModalOpen(true);
      else setIsLimitModalOpen(true);
      return;
    }

      if (isAlreadyInSystem && isAlreadyInSystem.is_deleted) {
        // Tweak Logic: Re-activate old property ID without consuming a new slot
        const { error: restoreError } = await supabase
          .from('clients')
          .update({ is_deleted: false, name: newClientName })
          .eq('user_email', email)
          .eq('property_id', cleanPropId);

        if (restoreError) {
          alert("Error restoring client");
          return;
        }
        
        // Remove from archived locally for instant UI update
        setArchivedClients(prev => prev.filter(c => c.property_id !== cleanPropId));
      } else if (!isAlreadyInSystem) {
        // Add brand new client
        const { error: insertError } = await supabase
          .from('clients')
          .insert([{ 
            user_email: email, 
            name: newClientName, 
            property_id: cleanPropId,
            has_generated_report: false 
          }]);

      if (insertError) {
        alert("Error adding client");
        return;
      }
    }

    // Refresh list
    const { data: refreshed } = await supabase
      .from('clients')
      .select('*')
      .eq('user_email', email)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    
    setClients(refreshed?.map(c => ({
      id: c.id,
      name: c.name,
      propertyId: c.property_id,
      lastReport: c.last_report || 'Never',
      hasGeneratedReport: c.has_generated_report || false
    })) || []);

    setIsModalOpen(false);
    setNewClientName('');
    setNewClientProp('');
  };

  const handleDelete = async (id: string) => {
    // Find the client to move to archive locally
    const clientToArchive = clients.find(c => c.id === id);

    // Identity-Based Logic: Soft delete to keep the slot "locked" if it has a report
    const { error } = await supabase
      .from('clients')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setClients(prev => prev.filter(c => c.id !== id));
      
      // Dynamic Update: If this client had a report, move it to archived state instantly
      if (clientToArchive?.hasGeneratedReport) {
        setArchivedClients(prev => [{
          ...clientToArchive,
          property_id: clientToArchive.propertyId,
          last_report: clientToArchive.lastReport
        }, ...prev]);
      }
    }
    setDeleteId(null);
    
    if (error) {
      console.error('Error deleting client:', error);
      alert('Failed to delete client. Please refresh and try again.');
    }
  };

  // ── Auth gates ────────────────────────────────────────────────────────────
  // Show a minimal skeleton while NextAuth resolves the session
  if (status === 'loading') {
    return (
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.logo}><Zap size={20} /> GA4 Explainer</div>
          </div>
        </header>
      </main>
    );
  }

  // Not logged in → show premium sign-in landing
  if (status === 'unauthenticated') {
    return (
      <div className={styles.signInPage}>
        <div className={styles.signInCard}>
          <div className={styles.signInLogo}>
            <Zap size={28} />
            GA4 Explainer
          </div>
          <h1 className={styles.signInTitle}>
             Your clients ask &quot;How did we do?&quot; — answer them in 30 seconds.
          </h1>
          <p className={styles.signInSubtitle}>
            Stop struggling with GA4 dashboards. Stop worrying about monthly reports. Connect your data and generate plain-English summaries your clients will actually read.
          </p>
          
          {/* How It Works */}
          <div style={{ width: '100%', margin: '20px 0', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '15px' }}>How it works</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', textAlign: 'center' }}>
              <div>
                <div style={{ background: 'var(--secondary)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '12px', fontWeight: '700' }}>1</div>
                <p style={{ fontSize: '11px', fontWeight: '600' }}>Connect GA4</p>
              </div>
              <div>
                <div style={{ background: 'var(--secondary)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '12px', fontWeight: '700' }}>2</div>
                <p style={{ fontSize: '11px', fontWeight: '600' }}>AI Summary</p>
              </div>
              <div>
                <div style={{ background: 'var(--secondary)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: '12px', fontWeight: '700' }}>3</div>
                <p style={{ fontSize: '11px', fontWeight: '600' }}>One-Click PDF</p>
              </div>
            </div>
          </div>

          <button
            id="google-signin-btn"
            className={styles.signInBtn}
            onClick={() => signIn('google')}
            style={{ marginBottom: '16px' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
          
          <p className={styles.signInNote}>Join 10+ agencies saving 20h/month on reporting.</p>
          <div style={{ marginTop: '24px', textAlign: 'center', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px' }}>
            <Link href="/pricing" style={{ color: 'var(--primary)', fontWeight: '600', fontSize: '13px' }}>View Pricing</Link>
            <div style={{ width: '100%', height: '8px' }}></div>
            <Link href="/privacy" style={{ color: '#a1a1aa', fontSize: '11px', textDecoration: 'none' }}>Privacy Policy</Link>
            <Link href="/terms" style={{ color: '#a1a1aa', fontSize: '11px', textDecoration: 'none' }}>Terms of Service</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated: render dashboard ──────────────────────────────────────
  // Don't show client grid until localStorage has been read
  if (!mounted) {
    return (
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.logo}><Zap size={20} /> GA4 Explainer</div>
            <div>
              <h1 className={styles.title}>Your Clients</h1>
              <p className={styles.subtitle}>Loading…</p>
            </div>
          </div>
        </header>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.logo}>
            <Zap size={20} />
            GA4 Explainer
          </div>
          <div>
            <h1 className={styles.title}>Your Clients</h1>
            <p className={styles.subtitle}>{clients.length} {clients.length === 1 ? 'client' : 'clients'} · Click any card to generate a report</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isPro ? (
            <div className={styles.proBadge} style={{ background: userPlan === 'agency' ? 'linear-gradient(135deg, #7c3aed 0%, #5b4cf0 100%)' : undefined }}>
              <CheckCircle size={14} /> {userPlan === 'agency' ? 'AGENCY' : 'STARTER'} PLAN
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-primary"
                onClick={() => handleUpgrade('starter')}
                disabled={isCheckoutLoading}
                style={{ padding: '8px 12px', fontSize: '12px', background: 'var(--foreground)', color: 'var(--background)' }}
              >
                Starter
              </button>
              <button
                className="btn-primary"
                onClick={() => handleUpgrade('agency')}
                disabled={isCheckoutLoading}
                style={{ padding: '8px 12px', fontSize: '12px', background: 'var(--primary)', color: 'white' }}
              >
                Agency
              </button>
            </div>
          )}
          {session?.user?.image && (
            <img
              src={session.user.image}
              alt={session.user.name || 'User'}
              className={styles.userAvatar}
              title={session.user.email || ''}
            />
          )}
          <ThemeToggle />
          <Link href="/pricing" className="btn-secondary" style={{ padding: '8px 14px', fontSize: '13px' }}>
            Pricing
          </Link>
          <button className="btn-secondary" onClick={() => signOut()} title="Sign out" style={{ padding: '8px 14px', fontSize: '13px' }}>
            <LogOut size={15} /> Sign out
          </button>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={18} />
            Add Client
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      {clients.length > 0 && (
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <Users size={16} />
            <span><strong>{clients.length}</strong> Clients managed</span>
          </div>
          <div className={styles.statItem}>
            <TrendingUp size={16} />
            <span>Reports generated with <strong>Advanced AI</strong></span>
          </div>
          <div className={styles.statItem}>
            <FileText size={16} />
            <span><strong>GA4</strong> data · Last 30 days</span>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Add New Client</h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddClient} className={styles.modalBody}>
              <div>
                <label className={styles.label}>Client / Business Name</label>
                <input
                  type="text"
                  className="input-field"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className={styles.label}>GA4 Property ID</label>
                <input
                  type="text"
                  className="input-field"
                  value={newClientProp}
                  onChange={e => setNewClientProp(e.target.value)}
                  placeholder="e.g. 123456789 (numeric ID only)"
                  required
                />
                
                {/* Restorable ID List (Identity Lock Transparency) */}
                {usedSlotsList.length > 0 && (
                  <div style={{ marginTop: '12px', background: 'var(--secondary)', padding: '10px', borderRadius: '8px', fontSize: '11px' }}>
                    <p style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--muted)' }}>RESTorable IDs (Click to pre-fill):</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {usedSlotsList.map(item => (
                        <button 
                          key={item.id} 
                          type="button"
                          onClick={() => {
                            setNewClientName(item.name);
                            setNewClientProp(item.id);
                          }}
                          style={{ 
                            background: 'var(--background)', 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            border: '1px solid var(--border)',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '500'
                          }}
                          title={`Restore ${item.name}`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>
                  Find this in GA4 → Admin → Property Settings → Property ID
                </p>
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: '8px', width: '100%' }}>
                Save Client
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className={styles.modalOverlay} onClick={() => setDeleteId(null)}>
          <div className={styles.modal} style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Remove Client?</h2>
              <button className={styles.closeBtn} onClick={() => setDeleteId(null)}>
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ color: 'var(--muted)', marginBottom: '20px' }}>
                This will remove the client from your dashboard. You can add them back anytime.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setDeleteId(null)}>
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  style={{ flex: 1, background: '#ef4444' }}
                  onClick={() => handleDelete(deleteId)}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Limit Modal */}
      {isLimitModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsLimitModalOpen(false)}>
          <div className={styles.modal} style={{ maxWidth: '440px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader} style={{ justifyContent: 'center' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Zap size={20} color="#7c3aed" fill="#7c3aed" /> Limit Reached
              </h2>
            </div>
            <div className={styles.modalBody} style={{ padding: '32px 24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ background: 'var(--secondary)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Users size={32} color="var(--primary)" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Move to Agency Plan</h3>
                <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: '1.5' }}>
                  The <strong>Starter Plan</strong> is limited to 5 clients. Switch to the <strong>Agency Plan</strong> to manage unlimited clients and unlock advanced AI features.
                </p>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  className="btn-primary" 
                  style={{ background: 'var(--primary)', color: 'white', padding: '14px' }}
                  onClick={() => {
                    setIsLimitModalOpen(false);
                    handleUpgrade('agency');
                  }}
                >
                  Upgrade to Agency
                </button>
                <button 
                  className="btn-secondary" 
                  onClick={() => setIsLimitModalOpen(false)}
                  style={{ padding: '12px' }}
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trial Limit Modal */}
      {isTrialModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsTrialModalOpen(false)}>
          <div className={styles.modal} style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 style={{ width: '100%', textAlign: 'center', fontSize: '20px' }}>You&apos;ve reached the free trial limit (2 clients)</h2>
            </div>
            {usedSlotsList.length > 0 && (
              <div style={{ padding: '0 24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                Slots already used for: <strong>{usedSlotsList.join(', ')}</strong>
              </div>
            )}
            <div className={styles.modalBody} style={{ padding: '32px 24px' }}>
              <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: '32px', fontSize: '14px' }}>
                You&apos;re on a 7-day free trial. To add more clients, pick the plan that fits your agency:
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                {/* Starter Plan */}
                <div style={{ padding: '24px', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--card-bg)' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Starter</h3>
                  <p style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)' }}>₹2,999/mo</p>
                  <ul style={{ padding: 0, margin: 0, listStyle: 'none', fontSize: '13px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={14} color="#16a34a" /> Up to 5 clients</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={14} color="#16a34a" /> + All core features</li>
                  </ul>
                  <button 
                    className="btn-primary" 
                    style={{ marginTop: 'auto', padding: '12px', fontSize: '13px' }}
                    onClick={() => {
                      setIsTrialModalOpen(false);
                      handleUpgrade('starter');
                    }}
                  >
                    Choose Starter
                  </button>
                </div>
                
                {/* Agency Plan */}
                <div style={{ padding: '24px', border: '2px solid var(--primary)', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: 'color-mix(in srgb, var(--primary) 5%, transparent)', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '-12px', right: '12px', background: 'var(--primary)', color: 'white', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }}>RECOMMENDED</div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Agency</h3>
                  <p style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)' }}>₹5,999/mo</p>
                  <ul style={{ padding: 0, margin: 0, listStyle: 'none', fontSize: '13px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={14} color="#16a34a" /> Unlimited clients</li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={14} color="#16a34a" /> + White-label reports</li>
                  </ul>
                  <button 
                    className="btn-primary" 
                    style={{ marginTop: 'auto', padding: '12px', fontSize: '13px', background: 'var(--primary)', color: 'white' }}
                    onClick={() => {
                      setIsTrialModalOpen(false);
                      handleUpgrade('agency');
                    }}
                  >
                    Choose Agency
                  </button>
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
                   Already love it? Your trial ends in <strong>{trialDaysRemaining ?? 7} days</strong>.
                </p>
                <button 
                  onClick={() => setIsTrialModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Continue with current plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Client Grid */}
      <div className={styles.grid}>
        {clients.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}><Users size={32} /></div>
            <h3>No clients yet</h3>
            <p>Add your first client to start generating plain-English GA4 reports in seconds.</p>
            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} />
              Add Your First Client
            </button>
          </div>
        ) : (
          clients.map(client => (
            <div key={client.id} className={`card ${styles.clientCard}`}>
              <div className={styles.clientHeader}>
                <div className={styles.clientAvatar}>
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className={styles.clientName}>{client.name}</h2>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span className={styles.status}>Active</span>
                    {client.hasGeneratedReport && (
                      <span style={{ fontSize: '10px', background: 'color-mix(in srgb, #16a34a 10%, transparent)', color: '#16a34a', padding: '2px 6px', borderRadius: '4px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <CheckCircle size={10} /> Saved Slot
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.clientMeta}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>GA4 Property</span>
                  <code className={styles.metaValue}>{client.propertyId}</code>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Last Report</span>
                  <span className={styles.metaValue}>{client.lastReport}</span>
                </div>
              </div>
              <div className={styles.cardActions}>
                <Link
                  href={`/client/${encodeURIComponent(client.propertyId)}/report?name=${encodeURIComponent(client.name)}&clientId=${client.id}`}
                  className="btn-primary"
                  style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
                >
                  <FileText size={16} /> Generate Report
                </Link>
                <button
                  className="btn-secondary"
                  style={{ padding: '10px 14px' }}
                  onClick={() => setDeleteId(client.id)}
                  title="Remove client"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Archived / History Section */}
      {archivedClients.length > 0 && (
        <div style={{ marginTop: '60px', borderTop: '1px solid var(--border)', paddingTop: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', opacity: 0.8 }}>
            <Clock size={20} color="var(--muted)" />
            <h2 style={{ fontSize: '18px', color: 'var(--muted)' }}>Recently Generated Reports (Archived)</h2>
          </div>
          <div className={styles.grid} style={{ opacity: 0.7 }}>
            {archivedClients.map(client => (
              <div key={client.id} className={`card ${styles.clientCard}`} style={{ filter: 'grayscale(0.5)' }}>
                <div className={styles.clientHeader}>
                  <div className={styles.clientAvatar} style={{ background: 'var(--border)' }}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className={styles.clientName}>{client.name}</h2>
                    <span className={styles.status} style={{ background: 'var(--border)', color: 'var(--muted)' }}>Archived</span>
                  </div>
                </div>
                <div className={styles.clientMeta}>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>GA4 Property</span>
                    <code className={styles.metaValue}>{client.property_id}</code>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.metaLabel}>Last Generated</span>
                    <span className={styles.metaValue}>{client.last_report}</span>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <Link
                    href={`/client/${encodeURIComponent(client.property_id)}/report?name=${encodeURIComponent(client.name)}&clientId=${client.id}`}
                    className="btn-secondary"
                    style={{ flex: 1, textDecoration: 'none', textAlign: 'center' }}
                  >
                    <FileText size={16} /> View Archived Report
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ marginTop: '60px', paddingTop: '20px', borderTop: '1px solid var(--border)', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <Link href="/privacy" style={{ color: 'var(--muted)', fontSize: '13px', textDecoration: 'none' }}>
          Privacy Policy
        </Link>
        <Link href="/terms" style={{ color: 'var(--muted)', fontSize: '13px', textDecoration: 'none' }}>
          Terms of Service
        </Link>
      </footer>
    </main>
  );
}
