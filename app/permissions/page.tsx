'use client';
// app/permissions/page.tsx — "My Permissions" consent revocation panel

import { useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import Nav from '@/components/Nav';

const SOURCE_META: Record<string, { name: string; abbr: string; bg: string; scopes: string }> = {
  mono:        { name: 'Mono Connect',       abbr: 'MC', bg: '#1A1A2E', scopes: 'read:transactions, read:balance' },
  opay:        { name: 'OPay Wallet',        abbr: 'OP', bg: '#007B5E', scopes: 'read:transactions, read:wallet' },
  remita:      { name: 'Remita',             abbr: 'RM', bg: '#E8401C', scopes: 'read:payment_history' },
  cooperative: { name: 'Cooperative',        abbr: 'CO', bg: '#1A4A2E', scopes: 'read:savings, read:repayments' },
};

export default function PermissionsPage() {
  const { user, isLoading } = useUser();
  const [sources, setSources] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokeSuccess, setRevokeSuccess] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/sources/connect').then(r => r.json()),
      fetch('/api/audit?limit=20').then(r => r.json()),
    ]).then(([sourcesData, auditData]) => {
      setSources(sourcesData.sources || getMockSources());
      setAuditLog(auditData.log || getMockLog());
      setLoading(false);
    }).catch(() => {
      setSources(getMockSources());
      setAuditLog(getMockLog());
      setLoading(false);
    });
  }, []);

  async function revoke(sourceKey: string) {
    setRevoking(sourceKey);
    try {
      await fetch('/api/audit', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceKey }),
      });
      setSources(s => s.filter(src => src.source_key !== sourceKey));
      setRevokeSuccess(`Access to ${SOURCE_META[sourceKey]?.name || sourceKey} has been permanently revoked.`);
      setTimeout(() => setRevokeSuccess(null), 4000);
    } catch {
      alert('Failed to revoke. Please try again.');
    } finally {
      setRevoking(null);
    }
  }

  if (isLoading || loading) return <><Nav /><main style={{ maxWidth: 600, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}><div style={{ color: 'var(--ink-mid)' }}>Loading…</div></main></>;

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px 100px' }} className="page-enter">

        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--earth)', marginBottom: 8 }}>
          Your control panel
        </div>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 10 }}>
          My permissions
        </h1>
        <p style={{ fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.6, marginBottom: 28 }}>
          Every connection FinAgent has on your behalf. Revoke any access instantly — permanently.
        </p>

        {revokeSuccess && (
          <div style={{
            background: 'rgba(26,74,46,0.1)', border: '1px solid rgba(26,74,46,0.3)',
            borderRadius: 10, padding: '12px 14px',
            fontSize: 13, color: 'var(--forest)', marginBottom: 16,
          }}>
            ✓ {revokeSuccess}
          </div>
        )}

        {/* Connected sources */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-mid)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Active connections ({sources.length})
          </div>

          {sources.length === 0 ? (
            <div style={{
              background: 'var(--white)', borderRadius: 'var(--radius-sm)',
              padding: 20, textAlign: 'center',
              fontSize: 14, color: 'var(--ink-mid)',
            }}>
              No active connections. Connect sources from the{' '}
              <a href="/connect" style={{ color: 'var(--forest)' }}>Connect page</a>.
            </div>
          ) : sources.map(src => {
            const meta = SOURCE_META[src.source_key] || { name: src.source_name, abbr: '??', bg: '#888', scopes: 'unknown' };
            const isRevoking = revoking === src.source_key;
            return (
              <div key={src.source_key} style={{
                background: 'var(--white)',
                border: '1.5px solid var(--sand-dark)',
                borderRadius: 'var(--radius-sm)',
                padding: 16, marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 14,
                opacity: isRevoking ? 0.5 : 1,
                transition: 'opacity 0.3s',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: meta.bg, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                }}>
                  {meta.abbr}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>{meta.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mid)', marginBottom: 2 }}>Scope: {meta.scopes}</div>
                  <div style={{ fontSize: 11, color: 'var(--forest-mid)' }}>
                    Connected {new Date(src.connected_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    color: 'var(--forest)', fontSize: 12, fontWeight: 500, marginBottom: 6,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--forest-light)' }} />
                    Active
                  </div>
                  <button
                    onClick={() => revoke(src.source_key)}
                    disabled={isRevoking}
                    style={{
                      background: '#FEF2F2', color: '#991B1B',
                      border: '1px solid #FCA5A5', borderRadius: 6,
                      padding: '5px 10px', fontSize: 12, fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {isRevoking ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Auth0 explanation */}
        <div style={{
          background: '#EEF2FF', border: '1px solid #C7D2FE',
          borderRadius: 'var(--radius-sm)',
          padding: '14px 16px',
          fontSize: 13, color: '#3730A3',
          marginBottom: 28, lineHeight: 1.6,
        }}>
          <strong>🔐 Auth0 Token Vault</strong><br />
          Revoking removes your OAuth token from Auth0's encrypted vault. FinAgent immediately loses ability to read that source — no data is retained. The action is permanent and instant.
        </div>

        {/* Consent audit log */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-mid)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            What FinAgent did on your behalf
          </div>
          <div style={{
            background: 'var(--white)', borderRadius: 'var(--radius-sm)',
            padding: '4px 16px',
            boxShadow: '0 2px 8px rgba(28,18,9,0.06)',
          }}>
            {auditLog.map((entry, i) => (
              <div key={entry.id || i} style={{
                display: 'flex', gap: 12, padding: '12px 0',
                borderBottom: i < auditLog.length - 1 ? '1px solid var(--sand-dark)' : 'none',
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--forest-light)',
                  marginTop: 5, flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 2 }}>
                    {entry.action} — {SOURCE_META[entry.source_key]?.name || entry.source_key}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mid)' }}>
                    {entry.scopes_used?.join(', ')} · Token: {entry.token_vault_id} · Node: {entry.agent_node}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--earth)', fontWeight: 500, whiteSpace: 'nowrap', alignSelf: 'center' }}>
                  {new Date(entry.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <a
          href="/api/auth/logout"
          style={{
            display: 'block', textAlign: 'center',
            fontSize: 13, color: 'var(--ink-mid)',
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}
        >
          Sign out
        </a>

      </main>
    </>
  );
}

// Mock data for demo without backend
function getMockSources() {
  return [
    { source_key: 'mono', source_name: 'Mono Connect', connected_at: new Date(Date.now() - 3600000).toISOString(), is_active: true },
    { source_key: 'opay', source_name: 'OPay Wallet', connected_at: new Date(Date.now() - 3500000).toISOString(), is_active: true },
    { source_key: 'remita', source_name: 'Remita', connected_at: new Date(Date.now() - 3400000).toISOString(), is_active: true },
    { source_key: 'cooperative', source_name: 'Cooperative', connected_at: new Date(Date.now() - 3300000).toISOString(), is_active: true },
  ];
}

function getMockLog() {
  const now = Date.now();
  return [
    { id: 1, action: 'READ_TRANSACTIONS', source_key: 'mono', scopes_used: ['read:transactions', 'read:balance'], token_vault_id: 'mono_****a8f2', agent_node: 'FETCH_MONO', created_at: new Date(now - 120000).toISOString() },
    { id: 2, action: 'READ_WALLET_HISTORY', source_key: 'opay', scopes_used: ['read:transactions', 'read:wallet'], token_vault_id: 'opay_****c91d', agent_node: 'FETCH_OPAY', created_at: new Date(now - 115000).toISOString() },
    { id: 3, action: 'READ_PAYMENT_HISTORY', source_key: 'remita', scopes_used: ['read:payment_history'], token_vault_id: 'rem_****b44e', agent_node: 'FETCH_REMITA', created_at: new Date(now - 110000).toISOString() },
    { id: 4, action: 'READ_SAVINGS_RECORDS', source_key: 'cooperative', scopes_used: ['read:savings', 'read:repayments'], token_vault_id: 'coop_****f12a', agent_node: 'FETCH_COOPERATIVE', created_at: new Date(now - 105000).toISOString() },
  ];
}
