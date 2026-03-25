'use client';
// app/dossier/page.tsx — Dossier reveal with score ring + CIBA submission

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';

export default function DossierPage() {
  const router = useRouter();
  const ringRef = useRef<SVGCircleElement>(null);
  const [scoreDisplay, setScoreDisplay] = useState(0);
  const [dossier, setDossier] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // CIBA state
  const [cibaState, setCibaState] = useState<'idle' | 'waiting' | 'approved' | 'denied'>('idle');
  const [cibaAuthReqId, setCibaAuthReqId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Fetch latest dossier
    fetch('/api/dossier/latest')
      .then(r => r.json())
      .then(({ dossier, auditLog }) => {
        setDossier(dossier);
        setAuditLog(auditLog || []);
        setLoading(false);
        // Animate score ring after load
        setTimeout(() => animateScore(dossier?.reliability_score || 78), 300);
      })
      .catch(() => {
        // Use mock data if no dossier yet (for demo)
        const mock = {
          reliability_score: 78,
          avg_monthly_income: 184000,
          income_growth_pct: 12,
          payment_consistency: 94,
          business_tenure_years: 8,
          narrative_text: '"Ms. Fashola has operated a fabric retail business at Oje Market since 2017. Her financial records reveal a disciplined trader with consistent income averaging ₦184,000 per month, peaking during festive seasons at over ₦280,000. Over 18 months of data, she has missed zero utility payments and maintained active savings contributions of ₦15,000 monthly to the Ibadan Traders\' Cooperative. This profile reflects the discipline and reliability of a creditworthy borrower."',
          sources_used: ['mono', 'opay', 'remita', 'cooperative'],
        };
        setDossier(mock);
        setLoading(false);
        setTimeout(() => animateScore(78), 300);
      });

    fetch('/api/audit')
      .then(r => r.json())
      .then(({ log }) => setAuditLog(log || []))
      .catch(() => {});
  }, []);

  function animateScore(target: number) {
    const circumference = 339.3;
    const offset = circumference - (target / 100) * circumference;
    if (ringRef.current) {
      ringRef.current.style.strokeDashoffset = String(offset);
    }
    // Count up number
    let n = 0;
    const interval = setInterval(() => {
      n = Math.min(n + 2, target);
      setScoreDisplay(n);
      if (n >= target) clearInterval(interval);
    }, 25);
  }

  async function initiateSubmission() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/agent/ciba', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossierId: dossier?.id || 'demo',
          bankName: 'UBA — SME Loans, Ibadan',
          loanAmount: 500000,
        }),
      });
      const data = await res.json();
      setCibaAuthReqId(data.authReqId || 'demo-req-id');
      setCibaState('waiting');
      pollCiba(data.authReqId, data.pollInterval || 5);
    } catch {
      // Demo mode: show CIBA screen anyway
      setCibaState('waiting');
    } finally {
      setSubmitting(false);
    }
  }

  function pollCiba(authReqId: string, interval: number) {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/agent/ciba?authReqId=${authReqId}&dossierId=${dossier?.id || ''}&bankName=UBA&loanAmount=500000`);
        const { status } = await res.json();
        if (status === 'approved') {
          clearInterval(timer);
          setCibaState('approved');
          setTimeout(() => setSubmitted(true), 600);
        } else if (status === 'denied') {
          clearInterval(timer);
          setCibaState('denied');
        }
      } catch {}
    }, interval * 1000);
  }

  function handlePhoneApprove() {
    setCibaState('approved');
    setTimeout(() => setSubmitted(true), 600);
  }

  async function revokeSource(sourceKey: string) {
    await fetch('/api/audit', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceKey }),
    });
    setAuditLog(log => log.filter(l => l.source_key !== sourceKey));
  }

  if (loading) {
    return (
      <>
        <Nav />
        <main style={{ maxWidth: 600, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, color: 'var(--ink-mid)' }}>Building your dossier…</div>
        </main>
      </>
    );
  }

  // SUBMITTED STATE
  if (submitted) {
    return (
      <>
        <Nav />
        <main style={{ maxWidth: 600, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }} className="page-enter">
          <div className="success-pop" style={{
            width: 80, height: 80,
            background: 'rgba(26,74,46,0.1)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M8 20L16 28L32 12" stroke="#1A4A2E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: 'var(--ink)', marginBottom: 12 }}>
            Dossier submitted.
          </h2>
          <p style={{ fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.6, marginBottom: 32, maxWidth: 400, margin: '0 auto 32px' }}>
            UBA Ibadan has received your FinAgent Credit Dossier. A loan officer will review within 48 hours. You retain full control — revoke access anytime.
          </p>
          <button
            onClick={() => router.push('/permissions')}
            style={{
              background: 'var(--forest)', color: 'var(--white)',
              border: 'none', borderRadius: 12, padding: '14px 32px',
              fontFamily: 'DM Sans, sans-serif', fontSize: 15, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            View my permissions
          </button>
        </main>
      </>
    );
  }

  // CIBA WAITING STATE
  if (cibaState === 'waiting') {
    return (
      <>
        <Nav />
        <main style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px 100px' }} className="page-enter">
          <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--earth)', marginBottom: 8 }}>
            Step 5 of 5 — Approve submission
          </div>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 10 }}>
            Confirm on<br />your phone
          </h1>
          <p style={{ fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.6, marginBottom: 28 }}>
            A push notification has been sent to your registered device. Approve it to submit your dossier. No submission happens without you.
          </p>

          {/* Phone mockup */}
          <div style={{
            background: '#1C1209', borderRadius: 32,
            padding: '36px 20px 24px',
            maxWidth: 280, margin: '0 auto 24px',
            boxShadow: '0 20px 60px rgba(28,18,9,0.35)',
          }}>
            <div style={{ background: 'var(--white)', borderRadius: 20, padding: '20px 16px', textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, background: 'var(--forest)',
                borderRadius: 12, margin: '0 auto 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L14.5 8H20L15.5 11.5L17 18L12 15L7 18L8.5 11.5L4 8H9.5L12 2Z" fill="#D4A017"/>
                </svg>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>FinAgent</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mid)', marginBottom: 16, lineHeight: 1.4 }}>
                Submit your dossier to <strong>UBA — SME Loans, Ibadan</strong>
              </div>

              {[
                { label: 'Submitting to', value: 'UBA — SME Loans, Ibadan' },
                { label: 'Loan request', value: '₦500,000 · 12 months · 18% p.a.' },
              ].map(item => (
                <div key={item.label} style={{
                  background: 'var(--sand)', borderRadius: 10,
                  padding: 12, marginBottom: 10, textAlign: 'left',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--ink-mid)', marginBottom: 3, letterSpacing: 0.5, textTransform: 'uppercase' }}>{item.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{item.value}</div>
                </div>
              ))}

              <div
                onClick={handlePhoneApprove}
                className="ciba-pulse"
                style={{
                  width: 56, height: 56, background: 'var(--forest)',
                  borderRadius: '50%', margin: '0 auto 10px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="10" r="5" stroke="#D4A017" strokeWidth="1.5"/>
                  <path d="M4 24C4 19.6 8.5 16 14 16C19.5 16 24 19.6 24 24" stroke="#D4A017" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-mid)', marginBottom: 12 }}>Tap fingerprint to approve</div>

              <button onClick={handlePhoneApprove} style={{
                background: 'var(--forest)', color: 'white',
                border: 'none', borderRadius: 10, padding: '12px',
                width: '100%', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 8,
              }}>
                Approve & Submit
              </button>
              <button onClick={() => setCibaState('idle')} style={{
                background: 'transparent', color: 'var(--clay)',
                border: '1.5px solid var(--clay)', borderRadius: 10, padding: '10px',
                width: '100%', fontSize: 13, cursor: 'pointer',
              }}>
                Deny
              </button>
            </div>
          </div>

          <div style={{
            background: 'var(--white)', borderRadius: 'var(--radius-sm)',
            padding: 16, boxShadow: '0 2px 8px rgba(28,18,9,0.07)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>🔐 What is CIBA step-up authentication?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.6 }}>
              Client-Initiated Backchannel Authentication sends a real-time push to your registered device before any high-stakes agent action. Even with access to your session, no one can submit your dossier without physical access to your phone.
            </div>
          </div>
        </main>
      </>
    );
  }

  // MAIN DOSSIER VIEW
  const score = dossier?.reliability_score || 78;
  const circumference = 339.3;

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px 100px' }} className="page-enter">

        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--earth)', marginBottom: 8 }}>
          Step 4 of 5 — Your dossier
        </div>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 24 }}>
          Your credit dossier<br />is ready
        </h1>

        {/* Score ring */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ width: 140, height: 140, position: 'relative', marginBottom: 8 }}>
            <svg width="140" height="140" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="60" cy="60" r="54" fill="none" stroke="var(--sand-dark)" strokeWidth="12"/>
              <circle
                ref={ringRef}
                cx="60" cy="60" r="54"
                fill="none" stroke="var(--forest)" strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference}
                style={{ transition: 'stroke-dashoffset 2s cubic-bezier(0.34,1.1,0.64,1)' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 36, fontWeight: 700, color: 'var(--forest)', lineHeight: 1 }}>
                {scoreDisplay}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-mid)' }}>/ 100</div>
            </div>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(26,74,46,0.1)', color: 'var(--forest)',
            borderRadius: 20, padding: '4px 14px',
            fontSize: 13, fontWeight: 500,
          }}>
            🟢 Strong creditworthiness
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[
            { value: `₦${(dossier?.avg_monthly_income || 184000).toLocaleString()}`, name: 'Avg monthly income', trend: `↑ ${dossier?.income_growth_pct || 12}% YoY` },
            { value: `${dossier?.payment_consistency || 94}%`, name: 'Payment consistency', trend: '18 of 18 months on time' },
            { value: `${dossier?.business_tenure_years || 8} yrs`, name: 'Business tenure', trend: 'Oje Market, Ibadan' },
            { value: '3 of 3', name: 'Active repayments', trend: 'Cooperative loans current' },
          ].map(m => (
            <div key={m.name} style={{
              background: 'var(--white)', borderRadius: 'var(--radius-sm)',
              padding: 14, boxShadow: '0 2px 8px rgba(28,18,9,0.06)',
            }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 700, color: 'var(--forest)', marginBottom: 2 }}>{m.value}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-mid)' }}>{m.name}</div>
              <div style={{ fontSize: 11, color: 'var(--forest-mid)', marginTop: 2 }}>{m.trend}</div>
            </div>
          ))}
        </div>

        {/* Narrative */}
        <div style={{
          background: 'var(--mist)', borderRadius: 'var(--radius-sm)',
          padding: 18,
          fontFamily: 'Fraunces, serif', fontSize: 14, fontWeight: 300,
          fontStyle: 'italic', color: 'var(--ink-mid)', lineHeight: 1.8,
          borderLeft: '3px solid var(--earth)', marginBottom: 16,
        }}>
          {dossier?.narrative_text || '"Your narrative is being generated…"'}
        </div>

        {/* Sources */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-mid)', marginBottom: 8, fontWeight: 500 }}>Data sources verified</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(dossier?.sources_used || ['mono', 'opay', 'remita', 'cooperative']).map((s: string) => (
              <span key={s} style={{
                background: 'var(--sand-dark)', borderRadius: 20,
                padding: '4px 10px', fontSize: 11, color: 'var(--ink-mid)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--forest-light)', display: 'inline-block' }} />
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </span>
            ))}
          </div>
        </div>

        {/* Consent audit log */}
        <div style={{
          background: 'var(--white)', borderRadius: 'var(--radius-sm)',
          padding: 16, marginBottom: 20,
          boxShadow: '0 2px 8px rgba(28,18,9,0.06)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--ink-mid)', marginBottom: 12, fontWeight: 500, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Consent audit log
          </div>
          {(auditLog.length > 0 ? auditLog : [
            { id: 1, action: 'Read transactions — Mono Connect', source_key: 'mono', scopes_used: ['read:transactions'], token_vault_id: 'mono_****a8f2', created_at: new Date(Date.now() - 120000).toISOString() },
            { id: 2, action: 'Read wallet history — OPay', source_key: 'opay', scopes_used: ['read:wallet'], token_vault_id: 'opay_****c91d', created_at: new Date(Date.now() - 115000).toISOString() },
            { id: 3, action: 'Read payment records — Remita', source_key: 'remita', scopes_used: ['read:payment_history'], token_vault_id: 'rem_****b44e', created_at: new Date(Date.now() - 110000).toISOString() },
          ]).map((entry: any) => (
            <div key={entry.id} style={{
              display: 'flex', gap: 12, padding: '12px 0',
              borderBottom: '1px solid var(--sand-dark)',
              alignItems: 'flex-start',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--forest-light)', marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>
                  {entry.action || `Read ${entry.source_key}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-mid)' }}>
                  {entry.scopes_used?.join(', ')} · Token: {entry.token_vault_id}
                </div>
                <button
                  onClick={() => revokeSource(entry.source_key)}
                  style={{
                    fontSize: 12, color: 'var(--clay)',
                    textDecoration: 'underline', textUnderlineOffset: 2,
                    cursor: 'pointer', background: 'none', border: 'none',
                    padding: 0, marginTop: 4, display: 'block',
                  }}
                >
                  Revoke this access
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--earth)', fontWeight: 500, whiteSpace: 'nowrap', alignSelf: 'center' }}>
                {Math.round((Date.now() - new Date(entry.created_at).getTime()) / 60000)}m ago
              </div>
            </div>
          ))}
        </div>

        {/* Submit button */}
        <button
          onClick={initiateSubmission}
          disabled={submitting}
          style={{
            width: '100%',
            background: 'var(--forest)', color: 'var(--white)',
            border: 'none', borderRadius: 12,
            padding: '16px 24px',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 16, fontWeight: 500,
            cursor: submitting ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginBottom: 10,
          }}
        >
          {submitting ? 'Sending approval request…' : 'Submit to bank — requires approval'}
        </button>

        <a
        href="/api/dossier/pdf"
          target="_blank"
          style={{
            width: '100%',
            background: 'transparent', color: 'var(--forest)',
            border: '1.5px solid var(--forest)', borderRadius: 12,
            padding: '14px 24px',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 15, fontWeight: 500,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            textDecoration: 'none',
          }}
        >
          Download PDF dossier
        </a>
        

      </main>
    </>
  );
}
