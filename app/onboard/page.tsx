'use client';
// app/onboard/page.tsx — Collect trader profile after Auth0 login

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@auth0/nextjs-auth0/client';
import Nav from '@/components/Nav';

const OCCUPATIONS = [
  'Fabric / clothing trader',
  'Food & provisions seller',
  'Electronics dealer',
  'Okada / transport operator',
  'Artisan (tailor, carpenter, etc.)',
  'Market stall owner',
  'Petty trader',
  'Other informal business',
];

export default function OnboardPage() {
  const router = useRouter();
  const { user, isLoading } = useUser();

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    occupation: '',
    market_location: '',
    years_in_trade: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (isLoading) return null;
  if (!user) {
    if (typeof window !== 'undefined') window.location.href = '/api/auth/login?returnTo=/onboard';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          years_in_trade: parseInt(form.years_in_trade) || 1,
        }),
      });

      if (!res.ok) throw new Error('Failed to save profile');
      router.push('/connect');
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--white)',
    border: '1.5px solid var(--sand-dark)',
    borderRadius: 10,
    padding: '12px 14px',
    fontFamily: 'DM Sans, sans-serif',
    fontSize: 15, color: 'var(--ink)',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13, fontWeight: 500,
    color: 'var(--ink-mid)',
    marginBottom: 6,
  };

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px 100px' }} className="page-enter">

        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--earth)', marginBottom: 8 }}>
          Step 1 of 5 — Your profile
        </div>

        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 10 }}>
          Tell us about<br />your business
        </h1>

        <p style={{ fontSize: 15, color: 'var(--ink-mid)', lineHeight: 1.6, marginBottom: 28 }}>
          This helps us frame your story accurately. The more context you give, the more compelling your dossier.
        </p>

        {/* Auth0 connected notice */}
        <div style={{
          background: '#EEF2FF', border: '1px solid #C7D2FE',
          borderRadius: 10, padding: '12px 14px',
          display: 'flex', gap: 10, alignItems: 'center',
          marginBottom: 24, fontSize: 13, color: '#3730A3',
        }}>
          <span>🔐</span>
          <div>Signed in as <strong>{user.email}</strong> via Auth0. Your identity is verified.</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div>
            <label style={labelStyle}>Full name</label>
            <input
              style={inputStyle}
              placeholder="e.g. Adunola Fashola"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Phone number</label>
            <input
              style={inputStyle}
              type="tel"
              placeholder="e.g. 08012345678"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              required
            />
            <div style={{ fontSize: 12, color: 'var(--ink-mid)', marginTop: 4 }}>
              This is your CIBA approval device — you'll receive a push notification here before any bank submission.
            </div>
          </div>

          <div>
            <label style={labelStyle}>Type of business</label>
            <select
              style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
              value={form.occupation}
              onChange={e => setForm(f => ({ ...f, occupation: e.target.value }))}
              required
            >
              <option value="">Select your occupation</option>
              {OCCUPATIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Market / location</label>
            <input
              style={inputStyle}
              placeholder="e.g. Oje Market, Ibadan"
              value={form.market_location}
              onChange={e => setForm(f => ({ ...f, market_location: e.target.value }))}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Years in this business</label>
            <input
              style={inputStyle}
              type="number" min="1" max="50"
              placeholder="e.g. 8"
              value={form.years_in_trade}
              onChange={e => setForm(f => ({ ...f, years_in_trade: e.target.value }))}
              required
            />
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FCA5A5',
              borderRadius: 8, padding: '10px 14px',
              fontSize: 13, color: '#991B1B',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            style={{
              width: '100%',
              background: saving ? 'var(--forest-mid)' : 'var(--forest)',
              color: 'var(--white)',
              border: 'none', borderRadius: 12,
              padding: '16px 24px',
              fontFamily: 'DM Sans, sans-serif',
              fontSize: 16, fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 8,
            }}
          >
            {saving ? 'Saving…' : (
              <>
                Continue to connect accounts
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </>
            )}
          </button>
        </form>
      </main>
    </>
  );
}
