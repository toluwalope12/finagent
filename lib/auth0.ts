// lib/auth0.ts
// Auth0 configuration, Token Vault helpers, and CIBA flow

import { getAccessToken, getSession } from '@auth0/nextjs-auth0';

// ============================================================
// TOKEN VAULT — fetch stored OAuth tokens for data sources
// ============================================================

export type SourceKey = 'mono' | 'opay' | 'remita' | 'cooperative';

const SOURCE_CONNECTION_MAP: Record<SourceKey, string> = {
  mono: 'mono-connect',       // Connection name in Auth0 dashboard
  opay: 'opay-wallet',
  remita: 'remita-payments',
  cooperative: 'cooperative-savings',
};

/**
 * Retrieve a Token Vault access token for a given data source.
 * This is the core Auth0 for AI Agents pattern —
 * the agent calls this before accessing any third-party API.
 */
export async function getTokenVaultToken(
  auth0UserId: string,
  source: SourceKey
): Promise<string> {
  const connection = SOURCE_CONNECTION_MAP[source];
  const mgmtToken = await getManagementToken();

  const res = await fetch(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${encodeURIComponent(auth0UserId)}/identity-providers/${connection}/token`,
    {
      headers: {
        Authorization: `Bearer ${mgmtToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token Vault: failed to get token for ${source}: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

/**
 * Get all connected sources for a user from Auth0 Token Vault.
 * Returns which sources have stored tokens.
 */
export async function getConnectedSources(auth0UserId: string): Promise<SourceKey[]> {
  const mgmtToken = await getManagementToken();

  const res = await fetch(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${encodeURIComponent(auth0UserId)}`,
    {
      headers: { Authorization: `Bearer ${mgmtToken}` },
    }
  );

  if (!res.ok) throw new Error('Failed to fetch user from Auth0');

  const user = await res.json();
  const identities = user.identities || [];

  return Object.entries(SOURCE_CONNECTION_MAP)
    .filter(([, connection]) =>
      identities.some((id: any) => id.connection === connection)
    )
    .map(([key]) => key as SourceKey);
}

/**
 * Revoke Token Vault access for a specific source.
 * Called from the "My Permissions" / consent revocation panel.
 */
export async function revokeSourceToken(
  auth0UserId: string,
  source: SourceKey
): Promise<void> {
  const connection = SOURCE_CONNECTION_MAP[source];
  const mgmtToken = await getManagementToken();

  const res = await fetch(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${encodeURIComponent(auth0UserId)}/identities/${connection}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${mgmtToken}` },
    }
  );

  if (!res.ok) throw new Error(`Failed to revoke token for ${source}`);
}

// ============================================================
// AUTH0 MANAGEMENT API — get machine-to-machine token
// ============================================================

let mgmtTokenCache: { token: string; expiresAt: number } | null = null;

async function getManagementToken(): Promise<string> {
  // Return cached token if still valid (5 min buffer)
  if (mgmtTokenCache && Date.now() < mgmtTokenCache.expiresAt - 300_000) {
    return mgmtTokenCache.token;
  }

  const res = await fetch(`${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_MGMT_CLIENT_ID,
      client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
      audience: process.env.AUTH0_MGMT_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });

  if (!res.ok) throw new Error('Failed to get Auth0 management token');

  const data = await res.json();
  mgmtTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// ============================================================
// CIBA — Client-Initiated Backchannel Authentication
// Step-up auth before high-stakes agent actions (dossier submission)
// ============================================================

export interface CibaRequest {
  authReqId: string;
  expiresIn: number;
  interval: number;
}

/**
 * Initiate a CIBA push notification to the user's device.
 * Call this BEFORE the agent submits a dossier to a bank.
 * The user must approve on their registered device.
 */
export async function initiateCibaApproval(
  loginHint: string,        // user's phone or email
  bindingMessage: string,   // shown on the device: "Approve FinAgent dossier submission"
  scope: string = 'openid profile'
): Promise<CibaRequest> {
  const res = await fetch(`${process.env.AUTH0_ISSUER_BASE_URL}/bc-authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH0_CLIENT_ID!,
      client_secret: process.env.AUTH0_CLIENT_SECRET!,
      login_hint: JSON.stringify({ format: 'iss_sub', iss: process.env.AUTH0_ISSUER_BASE_URL, sub: loginHint }),
      binding_message: `${process.env.AUTH0_CIBA_BINDING_MESSAGE_PREFIX}: ${bindingMessage}`,
      scope,
      request_expiry: '300',  // 5 minutes to approve
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`CIBA initiation failed: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return {
    authReqId: data.auth_req_id,
    expiresIn: data.expires_in,
    interval: data.interval || 5,
  };
}

/**
 * Poll for CIBA approval status.
 * Returns token if approved, throws if denied or expired.
 */
export async function pollCibaStatus(authReqId: string): Promise<'pending' | 'approved' | 'denied'> {
  const res = await fetch(`${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AUTH0_CLIENT_ID!,
      client_secret: process.env.AUTH0_CLIENT_SECRET!,
      grant_type: 'urn:openid:params:grant-type:ciba',
      auth_req_id: authReqId,
    }),
  });

  if (res.ok) return 'approved';

  const err = await res.json();
  if (err.error === 'authorization_pending') return 'pending';
  if (err.error === 'access_denied') return 'denied';
  if (err.error === 'expired_token') return 'denied';

  throw new Error(`CIBA poll error: ${JSON.stringify(err)}`);
}

// ============================================================
// SESSION HELPERS
// ============================================================

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user) return null;
  return session.user;
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}
