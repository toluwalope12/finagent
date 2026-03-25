# FinAgent 🌟
### Your financial story. Your control.

**AI-powered credit dossiers for Nigeria's 50 million informal economy workers.**

Built with Auth0 for AI Agents (Token Vault + CIBA), LangGraph, Next.js 14, Supabase, and Claude AI.

---

## What FinAgent Does

Adunola sells fabric at Oje Market. She earns ₦184,000/month, pays every bill on time, saves with her cooperative. But the bank sees no payslip and says no.

FinAgent reads her real financial story — from OPay, Mono, Remita, and her cooperative — and generates a structured credit dossier that banks can evaluate. With her explicit consent, at every step, before anything is shared.

---

## Architecture

```
User → Auth0 (identity + OAuth consent)
     → Auth0 Token Vault (encrypted token per source)
     → LangGraph Agent:
         FETCH_MONO → FETCH_OPAY → FETCH_REMITA → FETCH_COOPERATIVE
         → ANALYSE_INCOME
         → SCORE_RELIABILITY  
         → BUILD_NARRATIVE (Claude AI)
         → AWAIT_CIBA_APPROVAL (push notification)
         → SUBMIT_DOSSIER
     → Supabase (audit log + dossier storage)
     → Bank portal
```

### Auth0 for AI Agents features used:
- **Token Vault** — one encrypted OAuth token per data source, fetched just-in-time
- **CIBA** — push notification approval gate before bank submission
- **Connected Accounts** — standard OAuth flows to Mono, OPay, Remita
- **Consent scopes** — read-only scopes shown explicitly to user before connecting

---

## Quickstart

```bash
git clone https://github.com/yourusername/finagent
cd finagent
cp .env.example .env.local
# Fill in .env.local (see AUTH0_SETUP.md for step-by-step guide)

npm install
npm run dev
```

Open http://localhost:3000

**Follow AUTH0_SETUP.md** for the complete Auth0 + Supabase configuration.

---

## Key Files

| File | Purpose |
|------|---------|
| `lib/agent/finagent.ts` | LangGraph state machine — the agent |
| `lib/auth0.ts` | Token Vault + CIBA helpers |
| `lib/sources.ts` | Data source connectors (Mono, OPay, Remita) |
| `lib/db/supabase.ts` | Database helpers |
| `app/api/agent/run/route.ts` | Streaming agent endpoint (SSE) |
| `app/api/agent/ciba/route.ts` | CIBA step-up approval |
| `app/api/audit/route.ts` | Consent audit log + revocation |
| `supabase/schema.sql` | Full database schema with RLS |
| `AUTH0_SETUP.md` | Step-by-step Auth0 configuration |

---

## The Consent Architecture

Every agent action is logged. Every token is scoped. Every submission requires physical device approval.

```
1. User connects Mono → OAuth → Token Vault stores token
2. Agent starts → fetches token from Vault (never stored in our DB)
3. Every token read → logged in consent_audit_log
4. Before submission → CIBA push to phone
5. User approves on device → dossier submitted
6. User can revoke any token → instant, permanent, from UI
```

This is not just good UX. It's trust infrastructure.

---

## Built for the Auth0 "Authorized to Act" Hackathon 2026

> "What if agents could act in the world — authorized, accountable, and controllable?"

FinAgent answers: they can unlock financial dignity for the people most excluded by the formal system.

---

## License
MIT
