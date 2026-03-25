// app/api/auth/[auth0]/route.ts
// Handles /api/auth/login, /api/auth/logout, /api/auth/callback, /api/auth/me

import { handleAuth, handleLogin, handleCallback } from '@auth0/nextjs-auth0';

export const GET = handleAuth({
  login: handleLogin({
    authorizationParams: {
      // Request offline_access for refresh tokens
      scope: 'openid profile email offline_access',
    },
    returnTo: '/connect',
  }),

  callback: handleCallback({
    afterCallback: async (req, session) => {
      // Sync user to Supabase on first login
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
