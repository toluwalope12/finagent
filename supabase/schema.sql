-- ============================================================
-- FINAGENT DATABASE SCHEMA
-- Run this in Supabase SQL Editor: supabase.com > SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS — synced from Auth0 on first login
-- ============================================================
create table public.users (
  id              uuid primary key default uuid_generate_v4(),
  auth0_user_id   text unique not null,          -- Auth0 sub claim
  full_name       text,
  phone           text,
  bvn_verified    boolean default false,
  occupation      text,
  market_location text,
  years_in_trade  integer,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- CONNECTED_SOURCES — one row per Auth0 Token Vault token
-- ============================================================
create table public.connected_sources (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.users(id) on delete cascade,
  source_key      text not null,                 -- 'mono' | 'opay' | 'remita' | 'cooperative'
  source_name     text not null,
  token_vault_id  text not null,                 -- Auth0 Token Vault token ID
  scopes          text[] not null,               -- e.g. ['read:transactions', 'read:balance']
  is_active       boolean default true,
  connected_at    timestamptz default now(),
  revoked_at      timestamptz,
  unique(user_id, source_key)
);

-- ============================================================
-- CONSENT_AUDIT_LOG — immutable log of every agent action
-- ============================================================
create table public.consent_audit_log (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.users(id) on delete cascade,
  source_key      text not null,
  action          text not null,                 -- 'READ_TRANSACTIONS' | 'READ_BALANCE' etc
  token_vault_id  text not null,
  scopes_used     text[] not null,
  agent_node      text not null,                 -- LangGraph node that triggered this
  data_range      jsonb,                         -- { from: date, to: date, count: number }
  session_id      text,
  created_at      timestamptz default now()
);

-- ============================================================
-- DOSSIERS — generated credit dossiers
-- ============================================================
create table public.dossiers (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.users(id) on delete cascade,
  status          text default 'generating',     -- 'generating' | 'ready' | 'submitted' | 'approved'
  
  -- Computed financial profile
  avg_monthly_income    numeric(12,2),
  income_growth_pct     numeric(5,2),
  payment_consistency   numeric(5,2),           -- 0-100
  business_tenure_years integer,
  
  -- Reliability score (0-100)
  reliability_score     integer,
  score_breakdown       jsonb,                   -- { income: 30, consistency: 28, tenure: 20 }
  
  -- AI narrative
  narrative_text        text,
  
  -- Sources used
  sources_used          text[],
  
  -- CIBA approval
  ciba_request_id       text,
  approved_at           timestamptz,
  approved_by_device    text,
  
  -- PDF
  pdf_url               text,
  
  -- Submission
  submitted_to_bank     text,
  submitted_at          timestamptz,
  
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ============================================================
-- BANK_SUBMISSIONS — tracks dossier submissions to banks
-- ============================================================
create table public.bank_submissions (
  id              uuid primary key default uuid_generate_v4(),
  dossier_id      uuid references public.dossiers(id),
  user_id         uuid references public.users(id),
  bank_name       text not null,
  bank_branch     text,
  loan_amount     numeric(12,2),
  loan_purpose    text,
  status          text default 'pending',        -- 'pending' | 'reviewing' | 'approved' | 'rejected'
  submitted_at    timestamptz default now(),
  response_at     timestamptz,
  notes           text
);

-- ============================================================
-- RLS POLICIES — users can only see their own data
-- ============================================================
alter table public.users enable row level security;
alter table public.connected_sources enable row level security;
alter table public.consent_audit_log enable row level security;
alter table public.dossiers enable row level security;
alter table public.bank_submissions enable row level security;

-- Users policy
create policy "Users can read own record"
  on public.users for select
  using (auth0_user_id = current_setting('app.auth0_user_id', true));

-- Connected sources policies
create policy "Users can read own sources"
  on public.connected_sources for select
  using (user_id = (select id from public.users where auth0_user_id = current_setting('app.auth0_user_id', true)));

create policy "Users can insert own sources"
  on public.connected_sources for insert
  with check (user_id = (select id from public.users where auth0_user_id = current_setting('app.auth0_user_id', true)));

create policy "Users can update own sources"
  on public.connected_sources for update
  using (user_id = (select id from public.users where auth0_user_id = current_setting('app.auth0_user_id', true)));

-- Audit log policy (read-only for users)
create policy "Users can read own audit log"
  on public.consent_audit_log for select
  using (user_id = (select id from public.users where auth0_user_id = current_setting('app.auth0_user_id', true)));

-- Dossiers policies
create policy "Users can read own dossiers"
  on public.dossiers for select
  using (user_id = (select id from public.users where auth0_user_id = current_setting('app.auth0_user_id', true)));

-- ============================================================
-- INDEXES for performance
-- ============================================================
create index idx_connected_sources_user on public.connected_sources(user_id);
create index idx_audit_log_user on public.consent_audit_log(user_id);
create index idx_audit_log_created on public.consent_audit_log(created_at desc);
create index idx_dossiers_user on public.dossiers(user_id);
create index idx_users_auth0 on public.users(auth0_user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at timestamp
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at before update on public.users
  for each row execute function update_updated_at();

create trigger dossiers_updated_at before update on public.dossiers
  for each row execute function update_updated_at();
