// app/api/user/profile/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@auth0/nextjs-auth0';
import { upsertUser, getUserByAuth0Id } from '@/lib/db/supabase';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const user = await upsertUser(session.user.sub, body);
    return NextResponse.json({ user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await getUserByAuth0Id(session.user.sub);
    return NextResponse.json({ user });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
