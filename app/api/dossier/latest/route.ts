// app/api/dossier/latest/route.ts

import { NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { getLatestDossier, getAuditLog, getUserByAuth0Id } from '@/lib/db/supabase';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserByAuth0Id(session.user.sub);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const dossier = await getLatestDossier(user.id);
    const auditLog = await getAuditLog(user.id, 10);

    return NextResponse.json({ dossier, auditLog });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
