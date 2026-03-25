// app/api/agent/ciba/route.ts
// CIBA step-up authentication for dossier submission
// Sends push notification to user's device before any bank submission

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { initiateCibaApproval, pollCibaStatus } from '@/lib/auth0';
import { updateDossier, submitDossierToBank } from '@/lib/db/supabase';

// POST /api/agent/ciba — initiate CIBA approval
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dossierId, bankName, loanAmount } = await req.json();

    // Initiate CIBA — sends push to user's registered device
    const cibaRequest = await initiateCibaApproval(
      session.user.sub,
      `Submit your FinAgent dossier to ${bankName} for ₦${loanAmount?.toLocaleString() || 'loan application'}`,
      'openid profile'
    );

    // Store CIBA request ID on the dossier
    await updateDossier(dossierId, {
      ciba_request_id: cibaRequest.authReqId,
    });

    return NextResponse.json({
      authReqId: cibaRequest.authReqId,
      expiresIn: cibaRequest.expiresIn,
      pollInterval: cibaRequest.interval,
      message: 'A notification has been sent to your registered device. Please approve within 5 minutes.',
    });

  } catch (err: any) {
    console.error('CIBA initiation error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/agent/ciba?authReqId=xxx — poll for approval status
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authReqId = req.nextUrl.searchParams.get('authReqId');
    const dossierId = req.nextUrl.searchParams.get('dossierId');
    const bankName = req.nextUrl.searchParams.get('bankName');
    const loanAmount = req.nextUrl.searchParams.get('loanAmount');

    if (!authReqId) {
      return NextResponse.json({ error: 'authReqId required' }, { status: 400 });
    }

    const status = await pollCibaStatus(authReqId);

    if (status === 'approved' && dossierId && bankName) {
      // CIBA approved — record approval and submit dossier
      await updateDossier(dossierId, {
        approved_at: new Date().toISOString(),
      });

      if (bankName) {
        await submitDossierToBank(dossierId, session.user.sub, {
          bank_name: bankName,
          loan_amount: parseFloat(loanAmount || '0'),
          loan_purpose: 'Business working capital',
        });
      }
    }

    return NextResponse.json({ status });

  } catch (err: any) {
    console.error('CIBA poll error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
