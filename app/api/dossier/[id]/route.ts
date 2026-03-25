// app/api/dossier/[id]/route.ts
// Get dossier data, trigger PDF generation

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { getServiceClient } from '@/lib/db/supabase';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = getServiceClient();

    // Get dossier with audit log
    const { data: dossier, error } = await db
      .from('dossiers')
      .select(`
        *,
        users!inner(auth0_user_id, full_name, occupation, market_location, years_in_trade),
        bank_submissions(*)
      `)
      .eq('id', params.id)
      .eq('users.auth0_user_id', session.user.sub)
      .single();

    if (error || !dossier) {
      return NextResponse.json({ error: 'Dossier not found' }, { status: 404 });
    }

    // Get audit log for this dossier session
    const { data: auditLog } = await db
      .from('consent_audit_log')
      .select('*')
      .eq('user_id', dossier.user_id)
      .gte('created_at', dossier.created_at)
      .order('created_at', { ascending: true });

    return NextResponse.json({ dossier, auditLog: auditLog || [] });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ========== app/api/dossier/[id]/pdf/route.ts ==========
// Generate PDF using Puppeteer
