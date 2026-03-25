// app/api/audit/route.ts
// Consent audit log — what the agent did on the user's behalf
// Also handles token revocation

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { getAuditLog, revokeConnectedSource, getUserByAuth0Id } from '@/lib/db/supabase';
import { revokeSourceToken } from '@/lib/auth0';

// GET — fetch audit log
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserByAuth0Id(session.user.sub);
    if (!user) return NextResponse.json({ log: [] });

    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '30');
    const log = await getAuditLog(user.id, limit);

    return NextResponse.json({ log });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — revoke a source token
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sourceKey } = await req.json();

    const user = await getUserByAuth0Id(session.user.sub);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Revoke in Auth0 Token Vault
    await revokeSourceToken(session.user.sub, sourceKey);

    // Mark as revoked in our database
    await revokeConnectedSource(user.id, sourceKey);

    return NextResponse.json({
      success: true,
      message: `Access to ${sourceKey} has been revoked. FinAgent can no longer read your data from this source.`
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
