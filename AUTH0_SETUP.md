# FinAgent — Auth0 Setup Guide
## Complete this before writing any code

---

## Step 1: Create your Auth0 account and tenant

1. Go to **auth0.com** → Sign up (free)
2. Create a new tenant → name it `finagent-dev`
3. Select **Nigeria** as your region (or EU for data residency)

---

## Step 2: Create your Application

1. Dashboard → **Applications** → **Create Application**
2. Name: `FinAgent`
3. Type: **Regular Web Application**
4. Click **Create**
5. Go to **Settings** tab — copy these into your `.env.local`:
   - Domain → `AUTH0_ISSUER_BASE_URL` (prefix with `https://`)
   - Client ID → `AUTH0_CLIENT_ID`
   - Client Secret → `AUTH0_CLIENT_SECRET`

6. Set **Allowed Callback URLs**: `http://localhost:3000/api/auth/callback`
7. Set **Allowed Logout URLs**: `http://localhost:3000`
8. Set **Allowed Web Origins**: `http://localhost:3000`
9. Click **Save Changes**

---

## Step 3: Enable AI Agents + Token Vault

> Token Vault is the core hackathon requirement.

1. Dashboard → **AI Agents** (left sidebar)
2. Click **Enable AI Agents**
3. Click **Token Vault** → **Enable Token Vault**
4. Copy the **Token Vault Audience** URL → `AUTH0_TOKEN_VAULT_AUDIENCE`

---

## Step 4: Create Connected Accounts (data sources)

For each source, create a Social Connection:

### Mono Connect
1. Dashboard → **Authentication** → **Social**
2. Click **+ Create Connection**
3. Select **Custom OAuth2**
4. Name: `mono-connect`
5. Authorization URL: `https://connect.mono.co/authorize`
6. Token URL: `https://api.withmono.com/v2/oauth/token`
7. Scope: `read:transactions read:balance`
8. Client ID: *(from Mono dashboard)*
9. Client Secret: *(from Mono dashboard)*
10. Enable **Store Access Token in Token Vault** ✓
11. Enable on your FinAgent application

### OPay Wallet
1. Same process → Name: `opay-wallet`
2. Authorization URL: `https://open.opayweb.com/oauth/authorize`
3. Token URL: `https://open.opayweb.com/oauth/token`
4. Scope: `read:transactions read:wallet`
5. Enable Token Vault storage ✓

### Remita
1. Name: `remita-payments`
2. Authorization URL: `https://login.remita.net/oauth2/authorize`
3. Token URL: `https://login.remita.net/oauth2/token`
4. Scope: `read:payment_history`
5. Enable Token Vault storage ✓

### Cooperative (Custom)
1. Name: `cooperative-savings`
2. Use **Custom Database** connection type
3. This uses mock data in sandbox mode — no OAuth needed for hackathon

---

## Step 5: Enable CIBA (Client-Initiated Backchannel Authentication)

> This is the step-up approval gate — the most impressive hackathon feature.

1. Dashboard → **Applications** → **FinAgent** → **Settings**
2. Scroll to **Advanced Settings** → **Grant Types**
3. Enable: `Client-Initiated Backchannel Authentication (CIBA)` ✓
4. Click **Save**

5. Dashboard → **Branding** → **Push Notifications**
6. Enable push notifications for CIBA
7. (For demo: CIBA will show an approval page in-browser)

---

## Step 6: Create Management API credentials

> Needed to call Token Vault APIs server-side.

1. Dashboard → **Applications** → **APIs**
2. Click **Auth0 Management API**
3. Go to **Machine to Machine Applications** tab
4. Authorize **FinAgent** to call the Management API
5. Grant these scopes:
   - `read:users`
   - `update:users`
   - `delete:users_app_metadata`
   - `read:user_idp_tokens` ← critical for Token Vault
6. Go to **Test** tab → copy the M2M credentials into `.env.local`:
   - Client ID → `AUTH0_MGMT_CLIENT_ID`
   - Client Secret → `AUTH0_MGMT_CLIENT_SECRET`

---

## Step 7: Generate AUTH0_SECRET

Run this in your terminal:
```bash
openssl rand -base64 32
```
Paste the output into `.env.local` as `AUTH0_SECRET`.

---

## Step 8: Set up Supabase

1. Go to **supabase.com** → New project → name it `finagent`
2. Copy your Project URL and keys into `.env.local`
3. Go to **SQL Editor** → paste the entire contents of `supabase/schema.sql` → Run

---

## Step 9: Install and run

```bash
# In your project folder:
cp .env.example .env.local
# Fill in .env.local with all values above

npm install
npm run dev
```

Open http://localhost:3000 — you should see the FinAgent welcome screen.

---

## Quick verification checklist

- [ ] Auth0 login works: visit `/api/auth/login`
- [ ] Callback URL is set correctly in Auth0 dashboard
- [ ] Token Vault is enabled (AI Agents section)
- [ ] Supabase schema is applied (tables appear in Table Editor)
- [ ] `ANTHROPIC_API_KEY` is set and valid
- [ ] At least one Connected Account (Mono sandbox) is configured

---

## Sandbox API Keys

### Mono Connect sandbox
1. Sign up at **app.mono.co** → Developer → Sandbox
2. Use test account: `0000000000` (any bank) with password `password`
3. This gives you realistic Nigerian transaction data

### OPay sandbox  
1. Sign up at **developer.opayweb.com**
2. Use sandbox base URL: `https://sandbox.opayweb.com`

---

## Common issues

**"Invalid callback URL"** → Check Allowed Callback URLs in Auth0 matches exactly  
**"Token Vault not found"** → Ensure AI Agents is enabled in Auth0 dashboard  
**"Management API 403"** → Check M2M app has `read:user_idp_tokens` scope  
**Supabase RLS blocking queries** → Use `getServiceClient()` on server routes
