import { handleAuth, handleLogin, handleCallback } from '@auth0/nextjs-auth0';
import { NextRequest } from 'next/server';

export const GET = handleAuth({
  login: handleLogin({
    authorizationParams: {
      scope: 'openid profile email offline_access',
    },
    returnTo: '/connect',
  }),

  callback: handleCallback({
    afterCallback: async (_req: NextRequest, session: any) => {
      const { upsertUser } = await import('@/lib/db/supabase');
      try {
        await upsertUser(session.user.sub, {
          full_name: session.user.name,
        });
      } catch (err) {
        console.error('Failed to sync user:', err);
      }
      return session;
    },
  }),
});