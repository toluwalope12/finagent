// lib/db/supabase.ts
// Supabase client + typed database helpers for FinAgent

import { createClient } from '@supabase/supabase-js';

// ============================================================
// CLIENTS
// ============================================================

// Browser-safe client (uses anon key, respects RLS)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-only client (uses service role, bypasses RLS for admin ops)
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Authenticated client — sets auth0_user_id for RLS policies
export function getAuthClient(auth0UserId: string) {
  const client = getServiceClient();
  // Set the user context for RLS
  client.rpc('set_config', {
    setting: 'app.auth0_user_id',
    value: auth0UserId,
  });
  return client;
}

// ============================================================
// USER HELPERS
// ============================================================

export async function upsertUser(auth0UserId: string, profile: {
  full_name?: string;
  phone?: string;
  occupation?: string;
  market_location?: string;
  years_in_trade?: number;
}) {
  const db = getServiceClient();
  const { data, error } = await db
    .from('users')
    .upsert({ auth0_user_id: auth0UserId, ...profile }, { onConflict: 'auth0_user_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getUserByAuth0Id(auth0UserId: string) {
  const db = getServiceClient();
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('auth0_user_id', auth0UserId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ============================================================
// CONNECTED SOURCES
// ============================================================

export async function saveConnectedSource(userId: string, source: {
  source_key: string;
  source_name: string;
  token_vault_id: string;
  scopes: string[];
}) {
  const db = getServiceClient();
  const { data, error } = await db
    .from('connected_sources')
    .upsert(
      { user_id: userId, ...source, is_active: true, revoked_at: null },
      { onConflict: 'user_id,source_key' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getConnectedSourcesForUser(userId: string) {
  const db = getServiceClient();
  const { data, error } = await db
    .from('connected_sources')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('connected_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function revokeConnectedSource(userId: string, sourceKey: string) {
  const db = getServiceClient();
  const { error } = await db
    .from('connected_sources')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('source_key', sourceKey);

  if (error) throw error;
}

// ============================================================
// CONSENT AUDIT LOG
// ============================================================

export async function logConsentAction(entry: {
  user_id: string;
  source_key: string;
  action: string;
  token_vault_id: string;
  scopes_used: string[];
  agent_node: string;
  data_range?: { from: string; to: string; count: number };
  session_id?: string;
}) {
  const db = getServiceClient();
  const { data, error } = await db
    .from('consent_audit_log')
    .insert(entry)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getAuditLog(userId: string, limit = 20) {
  const db = getServiceClient();
  const { data, error } = await db
    .from('consent_audit_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

// ============================================================
// DOSSIERS
// ============================================================

export async function createDossier(userId: string) {
  const db = getServiceClient();
  const { data, error } = await db
    .from('dossiers')
    .insert({ user_id: userId, status: 'generating' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateDossier(dossierId: string, updates: Record<string, any>) {
  const db = getServiceClient();
  const { data, error } = await db
    .from('dossiers')
    .update(updates)
    .eq('id', dossierId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getLatestDossier(userId: string) {
  const db = getServiceClient();
  const { data, error } = await db
    .from('dossiers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function submitDossierToBank(dossierId: string, userId: string, submission: {
  bank_name: string;
  bank_branch?: string;
  loan_amount: number;
  loan_purpose?: string;
}) {
  const db = getServiceClient();

  // Create submission record
  const { data, error } = await db
    .from('bank_submissions')
    .insert({ dossier_id: dossierId, user_id: userId, ...submission })
    .select()
    .single();

  if (error) throw error;

  // Update dossier status
  await db
    .from('dossiers')
    .update({
      status: 'submitted',
      submitted_to_bank: submission.bank_name,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', dossierId);

  return data;
}
