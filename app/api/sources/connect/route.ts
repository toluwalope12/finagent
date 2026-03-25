// app/api/sources/connect/route.ts
// For hackathon demo: all sources use mock/simulated connection
// Token Vault pattern is demonstrated through the audit log and agent flow

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { saveConnectedSource, getUserByAuth0Id } from '@/lib/db/supabase';

const SOURCE_CONFIG = {
  mono: {
    name: 'Mono Connect',
    scopes: ['read:transactions', 'read:balance'],
    weight: 35,
  },
  opay: {
    name: 'OPay Wallet',
    scopes: ['read:transactions', 'read:wallet'],
    weight: 30,
  },
  remita: {
    name: 'Remita',
    scopes: ['read:payment_history'],
    weight: 20,
  },
  cooperative: {
    name: 'Cooperative Society',
    scopes: ['read:savings', 'read:repayments'],
    weight: 15,
  },
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { source } = await req.json();
    const config = SOURCE_CONFIG[source as keyof typeof SOURCE_CONFIG];

    if (!config) {
      return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
    }

    const auth0UserId = session.user.sub;
    const user = await getUserByAuth0Id(auth0UserId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Simulate Token Vault token storage
    // In production: this would be the real OAuth token from Auth0 Token Vault
    const mockTokenId = `${source}_tv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    await saveConnectedSource(user.id, {
      source_key: source,
      source_name: config.name,
      token_vault_id: mockTokenId,
      scopes: config.scopes,
    });

    return NextResponse.json({
      status: 'connected',
      source,
      token_vault_id: mockTokenId,
      scopes: config.scopes,
    });

  } catch (err: any) {
    console.error('Source connect error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { getConnectedSourcesForUser, getUserByAuth0Id } = await import('@/lib/db/supabase');
    const user = await getUserByAuth0Id(session.user.sub);

    if (!user) {
      return NextResponse.json({ sources: [] });
    }

    const sources = await getConnectedSourcesForUser(user.id);
    return NextResponse.json({ sources });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}