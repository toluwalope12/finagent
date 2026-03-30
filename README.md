# FinAgent

**Your financial story. Your control.**

AI-powered credit dossiers for Nigeria's 50 million informal economy workers.

Live app: [finagent-phi.vercel.app](https://finagent-phi.vercel.app)

---

## The problem

Adunola sells fabric at Oje Market in Ibadan. She earns around 184,000 naira a month, pays every utility bill on time, and saves with her cooperative society. She has done this for nearly a decade.

Last month, her bank said no to a 500,000 naira business loan. The reason: no payslip, no formal credit history.

There are 50 million Adunolas in Nigeria. They represent 80% of the workforce and 1.8 trillion naira in annual informal trade. The IFC estimates a 240 billion dollar financing gap for informal SMEs across Sub-Saharan Africa.

FinAgent exists because we believe consent is not a checkbox. It is trust infrastructure.

---

## What FinAgent does

FinAgent connects a trader's financial accounts through Auth0 Token Vault — OPay mobile wallet, Mono bank statements, Remita utility payments, cooperative savings records — then runs an AI agent to analyse their financial history and generate a structured credit dossier that banks can evaluate.

Every step requires the user's explicit consent. Every token access is logged. Every bank submission requires real-time approval on the user's registered device.

---

## How it works

```
User authenticates via Auth0
  └── Connects data sources via OAuth (Token Vault stores one token per source)
        └── FinAgent LangGraph pipeline runs:
              FETCH_MONO      → reads bank transactions via Token Vault
              FETCH_OPAY      → reads wallet history via Token Vault
              FETCH_REMITA    → reads utility payments via Token Vault
              FETCH_COOPERATIVE → reads savings records
              ANALYSE_INCOME  → calculates averages, growth, patterns
              SCORE_RELIABILITY → builds 0-100 creditworthiness index
              BUILD_NARRATIVE → Claude AI writes credit recommendation memo
        └── CIBA step-up: push notification to user's phone before submission
  └── User approves on device → dossier submitted to bank
```

Every token access is written to an immutable consent audit log. Users can view the full log and revoke any source with one click from their permissions panel.

---

## Auth0 for AI Agents features used

**Token Vault** — one encrypted, read-only OAuth token per data source. Retrieved just-in-time by each agent node. The agent never stores credentials.

**CIBA (Client-Initiated Backchannel Authentication)** — push notification approval gate before any bank submission. Even with access to the user's session, no one can submit their dossier without physical approval on their registered device.

**Connected Accounts** — OAuth flows for Mono, OPay, Remita, and cooperative data sources.

**Management API** — `read:user_idp_tokens` scope enables server-side token retrieval inside the agent pipeline.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Agent | LangGraph (7-node pipeline) |
| AI narrative | Claude claude-sonnet-4-20250514 (Anthropic) |
| Identity | Auth0 Token Vault, CIBA, Connected Accounts |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Streaming | Server-Sent Events |
| Deployment | Vercel |
| Data sources | Mono Connect, OPay, Remita, Cooperative API |

---

## Key files

| File | Purpose |
|---|---|
| `lib/agent/finagent.ts` | The 7-node LangGraph agent pipeline |
| `lib/auth0.ts` | Token Vault helper, CIBA initiator and poller |
| `lib/sources.ts` | Data source connectors (Mono, OPay, Remita) |
| `lib/db/supabase.ts` | Database helpers and typed queries |
| `app/api/agent/run/route.ts` | SSE streaming endpoint that runs the agent |
| `app/api/agent/ciba/route.ts` | CIBA step-up initiation and polling |
| `app/api/audit/route.ts` | Consent audit log read and token revocation |
| `supabase/schema.sql` | Full database schema with RLS policies |
| `AUTH0_SETUP.md` | Step-by-step Auth0 configuration guide |

---

## The consent architecture

```
1. User connects Mono → OAuth flow → Token Vault stores encrypted token
2. Agent starts → retrieves token from Vault just-in-time (never stored in our DB)
3. Every token read → logged to consent_audit_log (source, scope, token ID, node, time)
4. Before submission → CIBA push sent to user's phone
5. User approves on device → dossier submitted to bank
6. User can revoke any token → instant, permanent, from the My Permissions panel
```

This is not just good UX. It is trust infrastructure.

---

## Running locally

```bash
git clone https://github.com/toluwalope12/finagent
cd finagent
cp .env.example .env.local
```

Fill in `.env.local` — follow `AUTH0_SETUP.md` for the complete Auth0 and Supabase configuration.

```bash
npm install --legacy-peer-deps
npm run dev -- -p 3005
```

Open [http://localhost:3005](http://localhost:3005)

### Minimum environment variables to run

```
AUTH0_SECRET=
AUTH0_BASE_URL=http://localhost:3005
AUTH0_ISSUER_BASE_URL=https://your-tenant.us.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
MONO_ENV=test
```

Run the Supabase schema before first use:
SQL Editor → paste contents of `supabase/schema.sql` → Run

---

## Built for

Auth0 "Authorized to Act" Hackathon 2026

> "What if agents could act in the world — authorized, accountable, and controllable?"

FinAgent answers: they can unlock financial dignity for the people most excluded by the formal system.

---

## What's next

- Real Mono Connect sandbox integration with live Nigerian bank data
- Bank portal dashboard for loan officers
- BVN (Bank Verification Number) identity verification
- Revenue model: banks pay per dossier, workers get the service free
- YC application

---

Built by Toluwalope Ajayi, Nigeria.

MIT License