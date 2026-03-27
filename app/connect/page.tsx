'use client';
// app/connect/page.tsx — Connect data sources via Auth0 Token Vault

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@auth0/nextjs-auth0/client';
import Nav from '@/components/Nav';

type SourceKey = 'mono' | 'opay' | 'remita' | 'cooperative';
type SourceStatus = 'idle' | 'connecting' | 'connected' | 'error';

const SOURCES = [
  {
    key: 'mono' as SourceKey,
    name: 'Mono Connect',
    desc: 'Bank account statements · Transaction history',
    scope: 'read:transactions, read:balance',
    abbr: 'MC',
    bg: '#1A1A2E',
    weight: 35,
  },
  {
    key: 'opay' as SourceKey,
    name: 'OPay Wallet',
    desc: 'Mobile money · Daily income flows',
    scope: 'read:transactions, read:wallet',
    abbr: 'OP',
    bg: '#007B5E',
    weight: 30,
  },
  {
    key: 'remita' as SourceKey,
    name: 'Remita',
    desc: 'Utility payments · Rent · Government bills',
    scope: 'read:payment_history',
    abbr: 'RM',
    bg: '#E8401C',
    weight: 20,
  },
  {
    key: 'cooperative' as SourceKey,
    name: 'Cooperative Society',
    desc: 'Savings records · Loan repayment history',
    scope: 'read:savings, read:repayments',
    abbr: 'CO',
    bg: '#1A4A2E',
    weight: 15,
  },
];

export default function ConnectPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  const [statuses, setStatuses] = useState<Record<SourceKey, SourceStatus>>({
    mono: 'idle', opay: 'idle', remita: 'idle', cooperative: 'idle',
  });
  const [strength, setStrength] = useState(0);

  if (!isLoading && !user) {
    if (typeof window !== 'undefined') window.location.href = '/api/auth/login?returnTo=/connect';
  }

  // Load already-connected sources from DB
  useEffect(() => {
    fetch('/api/sources/connect')
      .then(r => r.json())
      .then(({ sources }) => {
        if (!sources?.length) return;
        const next = { ...statuses };
        let pct = 0;
        sources.forEach((s: any) => {
          next[s.source_key as SourceKey] = 'connected';
          pct += SOURCES.find(x => x.key === s.source_key)?.weight || 0;
        });
        setStatuses(next);
        setStrength(pct);
      })
      .catch(() => {});
  }, []);

  async function connect(key: SourceKey) {
    if (statuses[key] === 'connected') return;

    setStatuses(s => ({ ...s, [key]: 'connecting' }));

    try {
      const res = await fetch('/api/sources/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: key }),
      });
      const data = await res.json();

      if (data.authUrl) {
        // OAuth redirect — Auth0 handles the flow, stores token in Token Vault
        window.location.href = data.authUrl;
        return;
      }

      // Immediate (e.g. cooperative mock)
      if (data.status === 'connected') {
        setStatuses(s => ({ ...s, [key]: 'connected' }));
        const weight = SOURCES.find(x => x.key === key)?.weight || 0;
        setStrength(prev => Math.min(100, prev + weight));
      }

    } catch {
      setStatuses(s => ({ ...s, [key]: 'error' }));
    }
  }

  const connectedCount = Object.values(statuses).filter(s => s === 'connected').length;
  const canAnalyse = connectedCount >= 2;

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px 100px' }} className="page-enter">

        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--earth)', marginBottom: 8 }}>
          Step 2 of 5 — Connect accounts
        </div>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 10 }}>
          Connect your<br />financial accounts
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.6, marginBottom: 24 }}>
          Each connection opens a secure OAuth flow. FinAgent receives a read-only token stored in Auth0 Token Vault — your password never touches our servers.
        </p>

        {/* Profile strength */}
        <div style={{
          background: 'var(--white)', borderRadius: 'var(--radius)',
          padding: '20px 24px', marginBottom: 20,
          boxShadow: '0 4px 24px rgba(28,18,9,0.10)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-mid)' }}>Profile strength</span>
            <span style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 700, color: 'var(--forest)' }}>
              {strength}%
            </span>
          </div>
          <div style={{ width: '100%', height: 8, background: 'var(--sand-dark)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
            <div className="strength-fill" style={{
              height: '100%',
              width: `${strength}%`,
              background: 'linear-gradient(90deg, var(--forest-light), var(--forest))',
              borderRadius: 4,
            }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-mid)' }}>
            {strength === 0 && 'Connect at least 2 sources to generate a dossier'}
            {strength > 0 && strength < 50 && 'Connect one more source for a stronger profile'}
            {strength >= 50 && '✓ Strong enough to generate a dossier'}
          </div>
        </div>

        {/* Source cards */}
        {SOURCES.map(src => {
          const status = statuses[src.key];
          return (
            <div
              key={src.key}
              onClick={() => connect(src.key)}
              style={{
                background: status === 'connected' ? 'rgba(26,74,46,0.04)' : 'var(--white)',
                border: `1.5px solid ${status === 'connected' ? 'var(--forest)' : status === 'connecting' ? 'var(--earth-light)' : 'var(--sand-dark)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: 16, marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 14,
                cursor: status === 'connected' ? 'default' : 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {/* Logo */}
              <div style={{
                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                background: src.bg, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700,
              }}>
                {src.abbr}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>{src.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-mid)' }}>{src.desc}</div>
                <div style={{ fontSize: 11, color: 'var(--forest-mid)', marginTop: 3, fontStyle: 'italic' }}>
                  Scope: {src.scope}
                </div>
              </div>

              {/* Status */}
              <div style={{
                fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 5,
                color: status === 'connected' ? 'var(--forest)' : status === 'connecting' ? 'var(--earth)' : 'var(--ink-mid)',
                flexShrink: 0,
              }}>
                {status === 'idle' && (
                  <><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} /> Connect</>
                )}
                {status === 'connecting' && (
                  <div style={{
                    width: 16, height: 16,
                    border: '2px solid var(--earth-light)',
                    borderTopColor: 'var(--earth)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                )}
                {status === 'connected' && (
                  <><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L5.5 10.5L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> Connected</>
                )}
                {status === 'error' && (
                  <span style={{ color: 'var(--clay)' }}>Failed — retry</span>
                )}
              </div>
            </div>
          );
        })}

        {/* Token Vault notice */}
        <div style={{
          background: '#EEF2FF', border: '1px solid #C7D2FE',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 14px',
          fontSize: 12, color: '#3730A3',
          display: 'flex', gap: 8, alignItems: 'flex-start',
          marginTop: 16, lineHeight: 1.5,
        }}>
          <span>🔐</span>
          <div><strong>Auth0 Token Vault</strong> — Each source gets its own encrypted OAuth token stored server-side. Scopes are read-only. FinAgent never handles your credentials or passwords.</div>
        </div>

        <button
          disabled={!canAnalyse}
          onClick={() => router.push('/analyse')}
          style={{
            width: '100%',
            background: canAnalyse ? 'var(--forest)' : 'var(--sand-deeper)',
            color: canAnalyse ? 'var(--white)' : 'var(--ink-mid)',
            border: 'none', borderRadius: 12,
            padding: '16px 24px', marginTop: 20,
            fontFamily: 'DM Sans, sans-serif',
            fontSize: 16, fontWeight: 500,
            cursor: canAnalyse ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {canAnalyse ? (
            <>Analyse my data <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></>
          ) : (
            `Connect ${2 - connectedCount} more source${2 - connectedCount !== 1 ? 's' : ''} to continue`
          )}
        </button>

      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}