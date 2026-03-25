'use client';
// components/Nav.tsx

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@auth0/nextjs-auth0/client';

const STEPS = [
  { href: '/',            label: 'Welcome'     },
  { href: '/onboard',     label: 'Profile'     },
  { href: '/connect',     label: 'Connect'     },
  { href: '/analyse',     label: 'Analyse'     },
  { href: '/dossier',     label: 'Dossier'     },
];

export default function Nav() {
  const pathname = usePathname();
  const { user } = useUser();

  const currentIdx = STEPS.findIndex(s => s.href === pathname);

  return (
    <nav style={{
      width: '100%',
      background: 'var(--white)',
      borderBottom: '1px solid var(--sand-dark)',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '60px',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32,
          background: 'var(--forest)',
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L11.5 7H16L12 10.5L13.5 16L9 13L4.5 16L6 10.5L2 7H6.5L9 2Z" fill="#D4A017"/>
          </svg>
        </div>
        <span style={{
          fontFamily: 'Fraunces, serif',
          fontSize: 20, fontWeight: 700,
          color: 'var(--forest)',
          letterSpacing: '-0.5px',
        }}>
          Fin<span style={{ color: 'var(--earth)' }}>Agent</span>
        </span>
      </Link>

      {/* Step dots */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {STEPS.map((step, i) => (
          <div
            key={step.href}
            title={step.label}
            style={{
              height: 8,
              width: i === currentIdx ? 24 : 8,
              borderRadius: i === currentIdx ? 4 : '50%',
              background: i < currentIdx
                ? 'var(--forest-light)'
                : i === currentIdx
                  ? 'var(--forest)'
                  : 'var(--sand-deeper)',
              transition: 'all 0.3s',
              cursor: 'default',
            }}
          />
        ))}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {user ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#E8F0FE',
              border: '1px solid #93B4F5',
              borderRadius: 20,
              padding: '4px 10px 4px 6px',
              fontSize: 12,
              color: '#1A3A8A',
              fontWeight: 500,
            }}>
              <div style={{ width: 6, height: 6, background: '#2563EB', borderRadius: '50%' }} />
              Auth0 secured
            </div>
            <Link
              href="/permissions"
              style={{ fontSize: 13, color: 'var(--ink-mid)', textDecoration: 'none' }}
            >
              My permissions
            </Link>
          </>
        ) : (
          <a
            href="/api/auth/login"
            style={{
              background: 'var(--forest)',
              color: 'var(--white)',
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Sign in
          </a>
        )}
      </div>
    </nav>
  );
}
