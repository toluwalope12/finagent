// app/page.tsx — Welcome screen

import Link from 'next/link';
import Nav from '@/components/Nav';

export default function WelcomePage() {
  return (
    <>
      <Nav />
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px 100px' }} className="page-enter">

        {/* Hero visual */}
        <div style={{
          width: '100%', height: 160,
          background: 'var(--forest)',
          borderRadius: 'var(--radius)',
          marginBottom: 28,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(196,154,42,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(74,155,107,0.25) 0%, transparent 40%)',
          }} />
          <div style={{ position: 'relative', textAlign: 'center' }}>
            <div style={{
              fontFamily: 'Fraunces, serif',
              fontSize: 52, fontWeight: 700,
              color: 'var(--gold)', lineHeight: 1,
              marginBottom: 4,
            }}>50M+</div>
            <div style={{
              fontSize: 12, fontWeight: 300,
              color: 'rgba(254,252,248,0.75)',
              letterSpacing: 1, textTransform: 'uppercase',
            }}>Nigerians invisible to banks</div>
          </div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--earth)', marginBottom: 8 }}>
          Your financial story
        </div>

        <h1 style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 30, fontWeight: 700,
          color: 'var(--ink)', lineHeight: 1.2,
          marginBottom: 10,
        }}>
          You have a credit history.<br />Banks just can't read it.
        </h1>

        <p style={{ fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.65, marginBottom: 28 }}>
          FinAgent reads your real financial story — from your OPay wallet, utility bills, and cooperative savings — and builds a dossier banks can understand. With your consent, always.
        </p>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
          {[
            { value: '₦1.8T', label: 'informal trade annually' },
            { value: '92%',   label: 'loan rejection rate' },
            { value: '₦0',   label: 'cost to you' },
          ].map(s => (
            <div key={s.value} style={{
              background: 'var(--white)',
              borderRadius: 'var(--radius-sm)',
              padding: 14, textAlign: 'center',
              boxShadow: '0 2px 8px rgba(28,18,9,0.07)',
            }}>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, color: 'var(--forest)', marginBottom: 2 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mid)', lineHeight: 1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Features */}
        {[
          { icon: '🔒', title: 'You stay in full control', desc: 'Every data source requires your explicit consent. You can revoke access anytime from your permissions panel.' },
          { icon: '📖', title: 'AI writes your story', desc: 'Our agent turns transaction patterns into a narrative a loan officer can believe in — factual, warm, and professional.' },
          { icon: '✅', title: 'You approve every action', desc: 'Before your dossier is submitted to any bank, you confirm on your registered phone. No submission happens without you.' },
        ].map(f => (
          <div key={f.title} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '14px 0',
            borderBottom: '1px solid var(--sand-dark)',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 8,
              background: 'rgba(26,74,46,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>{f.icon}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 3 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-mid)', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          </div>
        ))}

        {/* Consent notice */}
        <div style={{
          background: 'rgba(26,74,46,0.07)',
          border: '1px solid rgba(26,74,46,0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          display: 'flex', gap: 10, alignItems: 'flex-start',
          marginTop: 24, marginBottom: 24,
          fontSize: 13, color: 'var(--forest)', lineHeight: 1.5,
        }}>
          <span>🛡️</span>
          <div>FinAgent uses <strong>Auth0 Token Vault</strong> to store your credentials. We hold read-only, scoped access tokens — never your passwords.</div>
        </div>

        <Link href="/api/auth/login?returnTo=/onboard" style={{ textDecoration: 'none' }}>
          <button style={{
            width: '100%',
            background: 'var(--forest)', color: 'var(--white)',
            border: 'none', borderRadius: 12,
            padding: '16px 24px',
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 16, fontWeight: 500,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            Start building my profile
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </Link>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-mid)', marginTop: 14 }}>
          Already have an account?{' '}
          <a href="/api/auth/login?returnTo=/connect" style={{ color: 'var(--forest)' }}>Sign in</a>
        </p>

      </main>
    </>
  );
}
