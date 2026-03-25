'use client';
// app/analyse/page.tsx — Live agent analysis with Server-Sent Events

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';

const NODES = [
  { key: 'FETCH_MONO',       label: 'Fetching bank transactions',    detail: 'Reading from Mono Connect via Token Vault' },
  { key: 'FETCH_OPAY',       label: 'Fetching wallet history',       detail: 'Reading from OPay via Token Vault' },
  { key: 'FETCH_REMITA',     label: 'Fetching utility payments',     detail: 'Reading from Remita via Token Vault' },
  { key: 'FETCH_COOPERATIVE',label: 'Fetching savings records',      detail: 'Reading from Cooperative via Token Vault' },
  { key: 'ANALYSE_INCOME',   label: 'Analysing income patterns',     detail: 'Calculating monthly averages and growth' },
  { key: 'SCORE_RELIABILITY',label: 'Scoring reliability',           detail: 'Building your creditworthiness index' },
  { key: 'BUILD_NARRATIVE',  label: 'Writing your narrative',        detail: 'Claude composing your credit story' },
];

const STATUS_MESSAGES = [
  'Connecting to your accounts…',
  'Reading your financial history…',
  'Finding patterns in your data…',
  'Calculating your reliability score…',
  'Writing your story…',
  'Almost there…',
];

export default function AnalysePage() {
  const router = useRouter();

  const [nodeStates, setNodeStates] = useState<Record<string, 'idle' | 'running' | 'done'>>({});
  const [narrative, setNarrative] = useState('');
  const [narrativeVisible, setNarrativeVisible] = useState(false);
  const [statusMsg, setStatusMsg] = useState(STATUS_MESSAGES[0]);
  const [progress, setProgress] = useState(0);
  const [dossierId, setDossierId] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const statusIdx = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Cycle status messages
    const msgInterval = setInterval(() => {
      statusIdx.current = (statusIdx.current + 1) % STATUS_MESSAGES.length;
      setStatusMsg(STATUS_MESSAGES[statusIdx.current]);
    }, 3500);

    // Start SSE stream
    const evtSource = new EventSource('/api/agent/run');

    // POST to kick it off (EventSource only does GET, so we use fetch for POST)
    fetch('/api/agent/run', { method: 'POST' })
      .then(res => {
        if (!res.body) throw new Error('No stream');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        function pump() {
          reader.read().then(({ done: streamDone, value }) => {
            if (streamDone) return;
            const text = decoder.decode(value);

            // Parse SSE lines
            text.split('\n').forEach(line => {
              if (!line.startsWith('data: ')) return;
              try {
                const event = JSON.parse(line.slice(6));
                handleEvent(event);
              } catch {}
            });

            pump();
          });
        }

        pump();
      })
      .catch(err => {
        setError('Could not start analysis. Please check your connections and try again.');
        clearInterval(msgInterval);
      });

    return () => {
      clearInterval(msgInterval);
    };
  }, []);

  function handleEvent(event: any) {
    switch (event.type) {
      case 'agent_started':
        setDossierId(event.dossierId);
        setProgress(5);
        break;

      case 'node_start':
        setNodeStates(s => ({ ...s, [event.node]: 'running' }));
        setProgress(p => Math.min(p + 10, 85));
        break;

      case 'node_complete':
        setNodeStates(s => ({ ...s, [event.node]: 'done' }));
        setProgress(p => Math.min(p + 5, 90));
        break;

      case 'narrative_chunk':
        setNarrativeVisible(true);
        setNarrative(prev => prev + event.data.chunk);
        break;

      case 'complete':
        setProgress(100);
        setDone(true);
        // Navigate to dossier after brief pause
        setTimeout(() => router.push('/dossier'), 1500);
        break;

      case 'error':
        setError(event.message || 'An error occurred during analysis.');
        break;
    }
  }

  const completedCount = Object.values(nodeStates).filter(s => s === 'done').length;

  return (
    <>
      <Nav />
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '32px 24px 100px' }} className="page-enter">

        <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--earth)', marginBottom: 8 }}>
          Step 3 of 5 — Analysis
        </div>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 24 }}>
          Reading your<br />financial story…
        </h1>

        {/* Status hero */}
        <div style={{
          background: 'var(--forest)', borderRadius: 'var(--radius)',
          padding: '28px 24px', marginBottom: 20,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(196,154,42,0.2) 0%, transparent 60%)',
          }} />
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(254,252,248,0.6)', marginBottom: 6 }}>
              Agent status
            </div>
            <div style={{
              fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 700,
              color: 'var(--white)', marginBottom: 18,
              minHeight: 28,
            }}>
              {done ? '✓ Analysis complete' : error ? 'Analysis failed' : statusMsg}
            </div>
            <div style={{ width: '100%', height: 6, background: 'rgba(254,252,248,0.2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: done ? '#4A9B6B' : 'var(--gold)',
                borderRadius: 3,
                transition: 'width 0.8s ease',
              }} />
            </div>
            <div style={{ fontSize: 12, color: 'rgba(254,252,248,0.5)', marginTop: 6 }}>
              {completedCount} of {NODES.length} nodes complete
            </div>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FCA5A5',
            borderRadius: 10, padding: '14px 16px',
            fontSize: 14, color: '#991B1B', marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {/* Agent nodes */}
        <div style={{
          background: 'var(--white)', borderRadius: 'var(--radius)',
          padding: '8px 16px', marginBottom: 16,
          boxShadow: '0 4px 24px rgba(28,18,9,0.08)',
        }}>
          {NODES.map((node, i) => {
            const state = nodeStates[node.key] || 'idle';
            return (
              <div key={node.key} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '14px 0',
                borderBottom: i < NODES.length - 1 ? '1px solid var(--sand-dark)' : 'none',
              }}>
                {/* State indicator */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${state === 'done' ? 'var(--forest)' : state === 'running' ? 'var(--earth-light)' : 'var(--sand-deeper)'}`,
                  background: state === 'done' ? 'var(--forest)' : 'var(--white)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13,
                  animation: state === 'running' ? 'pulseBorder 1.2s ease-in-out infinite' : 'none',
                  transition: 'all 0.3s',
                }}>
                  {state === 'done' ? (
                    <svg className="check-pop" width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7L5.5 10.5L12 4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  ) : state === 'running' ? (
                    <div style={{
                      width: 12, height: 12,
                      border: '2px solid var(--earth-light)',
                      borderTopColor: 'var(--earth)',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--sand-deeper)' }}>{i + 1}</span>
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 500,
                    color: state === 'idle' ? 'var(--sand-deeper)' : 'var(--ink)',
                    marginBottom: 2, transition: 'color 0.3s',
                  }}>
                    {node.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mid)' }}>{node.detail}</div>
                </div>

                {/* Timestamp */}
                {state === 'done' && (
                  <div style={{ fontSize: 11, color: 'var(--forest-mid)', fontWeight: 500, alignSelf: 'center', whiteSpace: 'nowrap' }}>
                    ✓ done
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Live narrative */}
        {narrativeVisible && (
          <div style={{
            background: 'var(--white)', borderRadius: 'var(--radius)',
            padding: '20px 24px',
            boxShadow: '0 4px 24px rgba(28,18,9,0.08)',
            borderLeft: '4px solid var(--earth)',
            marginBottom: 16,
            animation: 'pageEnter 0.5s ease forwards',
          }}>
            <div style={{
              fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
              color: 'var(--earth)', marginBottom: 10,
            }}>
              ✍️ Live narrative preview
            </div>
            <div style={{
              fontFamily: 'Fraunces, serif',
              fontSize: 15, fontWeight: 300, fontStyle: 'italic',
              color: 'var(--ink)', lineHeight: 1.7,
            }}>
              {narrative}
              {!done && <span className="typing-cursor" />}
            </div>
          </div>
        )}

        {done && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 14, color: 'var(--forest)', fontWeight: 500 }}>
              ✓ Dossier ready — taking you there now…
            </div>
          </div>
        )}

      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulseBorder {
          0%, 100% { box-shadow: 0 0 0 0 rgba(196,154,42,0); }
          50%       { box-shadow: 0 0 0 4px rgba(196,154,42,0.2); }
        }
      `}</style>
    </>
  );
}
