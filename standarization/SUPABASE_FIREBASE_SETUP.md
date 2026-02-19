# Supabase & Firebase Setup Guide

> ResistanceZero SaaS Infrastructure Documentation
> Last updated: 2026-02-17

---

## Architecture Overview

```
[Browser] ──Firebase Auth──> [Firebase]
    │                            │
    │  JWT Token                 │ Verify Token
    ▼                            ▼
[Cloud Run API] ──service_role──> [Supabase PostgreSQL]
    │
    │  API Key
    ▼
[Mayar Payment Gateway]
```

- **Authentication**: Firebase Auth (Email/Password + Google OAuth)
- **Database**: Supabase PostgreSQL (DB only, no Supabase Auth)
- **Payment**: Mayar (QRIS/VA/eWallet/Card)
- **Backend**: Express.js on Google Cloud Run
- **Frontend**: Static HTML on Cloud Run (resistancezero.com)

---

## 1. Firebase Setup

### 1.1 Project Details
| Key | Value |
|-----|-------|
| Project ID | `resistancezero-a5ad5` |
| Project Number | `416280004490` |
| API Key | `AIzaSyCXlJbZyWHr74vkJOJaUsjVdv6iAa0kt6A` |
| Auth Domain | `resistancezero-a5ad5.firebaseapp.com` |
| Storage Bucket | `resistancezero-a5ad5.firebasestorage.app` |
| Messaging Sender ID | `416280004490` |
| App ID | `1:416280004490:web:9cc660ea78df69e1636a73` |
| Measurement ID | `G-4K4RPGTHV5` |
| Owner Email | `bagusdpermana7@gmail.com` |
| Hosting URL | `resistancezero-a5ad5.web.app` |

### 1.2 Firebase Console Setup Steps

1. **Create Project**: [console.firebase.google.com](https://console.firebase.google.com/)
   - Project name: `resistancezero`
   - Project ID: `resistancezero-a5ad5`
   - Enable Google Analytics (Measurement ID: G-4K4RPGTHV5)

2. **Add Web App**:
   - Firebase Console → Project Settings → General → Your apps → Add app → Web
   - Register app name: `resistancezero-web`
   - Copy `firebaseConfig` object → paste into `firebase-config.js`

3. **Enable Authentication**:
   - Firebase Console → Authentication → Sign-in method
   - Enable **Email/Password** (primary)
   - Enable **Google** (optional, for OAuth)
   - ⚠️ **Status**: Email/Password needs to be enabled by user

4. **Generate Service Account Key** (for backend):
   - Firebase Console → Project Settings → Service accounts
   - Click "Generate new private key"
   - Download JSON file
   - Extract `client_email` and `private_key`
   - Set in `.env`:
     ```
     FIREBASE_PROJECT_ID=resistancezero-a5ad5
     FIREBASE_CLIENT_EMAIL=<from JSON>
     FIREBASE_PRIVATE_KEY="<from JSON>"
     ```
   - OR set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`
   - ⚠️ **Status**: Pending — user needs to generate this

### 1.3 Frontend Config File
**File**: `Sandbox/firebase-config.js`
```javascript
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCXlJbZyWHr74vkJOJaUsjVdv6iAa0kt6A",
  authDomain: "resistancezero-a5ad5.firebaseapp.com",
  projectId: "resistancezero-a5ad5",
  storageBucket: "resistancezero-a5ad5.firebasestorage.app",
  messagingSenderId: "416280004490",
  appId: "1:416280004490:web:9cc660ea78df69e1636a73",
  measurementId: "G-4K4RPGTHV5"
};
const API_BASE = 'https://bfrfranco-github-io-586770625232.us-central1.run.app';
```

### 1.4 Backend Firebase Service
**File**: `cloud-functions/services/firebase.js`
- Credential resolution: `GOOGLE_APPLICATION_CREDENTIALS` → inline env vars → Application Default Credentials
- Gracefully warns if no credentials found (server still starts)
- Exports: `admin`, `auth`, `messaging`, `verifyIdToken()`

---

## 2. Supabase Setup

### 2.1 Project Details
| Key | Value |
|-----|-------|
| Project Ref | `bizrikfjfyxtxykuipvv` |
| Region | Singapore (ap-southeast-1) |
| URL | `https://bizrikfjfyxtxykuipvv.supabase.co` |
| Anon Key | `eyJhbGciOiJIUzI1NiIs...otukd5M1_FfxBVlklleMW7Gt_D_MPGWzcmwIFsVX9mY` |
| Service Role Key | `eyJhbGciOiJIUzI1NiIs...Gf70sx3HjtK8k1qgP_nM7owJUDjw18tJcIWqH8gHe2w` |
| DB Password | `Umum_Mirage7` |
| Direct Connection | `postgresql://postgres:Umum_Mirage7@db.bizrikfjfyxtxykuipvv.supabase.co:5432/postgres` |

### 2.2 Supabase Console Setup Steps

1. **Create Project**: [supabase.com/dashboard](https://supabase.com/dashboard)
   - Organization: (create or select)
   - Project name: `resistancezero`
   - Database password: set and save securely
   - Region: Singapore (closest to Jakarta)

2. **Get API Keys**:
   - Supabase Dashboard → Settings → API
   - Copy `anon` key (public, for client-side if needed)
   - Copy `service_role` key (secret, for backend only)
   - Copy Project URL

3. **Execute Schema**:
   - Supabase Dashboard → SQL Editor → New query
   - Paste contents of `Sandbox/Data/Freemium Scheme/supabase_schema_v2.sql`
   - Click Run
   - Expected result: "Success. No rows returned"
   - ✅ **Status**: Completed 2026-02-17

4. **Verify Schema**:
   - Run test: `cd cloud-functions && node test-schema.js`
   - Expected: 98/98 tests pass
   - ✅ **Status**: All tests passed 2026-02-17

5. **Execute DC Intelligence Schema** (optional, for admin panel benchmarks):
   - Supabase Dashboard → SQL Editor → New query
   - Paste contents of `Sandbox/Data/Freemium Scheme/supabase_dc_intelligence.sql`
   - Click Run
   - Creates 4 tables + seeds 50 operators, 28 countries, 35 facilities, 19 market metrics
   - Verify: `cd cloud-functions && node seed-dc-intel.js`
   - ⚠️ **Status**: Pending — user needs to run SQL

### 2.3 Schema Version
- **Core Schema Version**: v2.0.0
- **Core File**: `Sandbox/Data/Freemium Scheme/supabase_schema_v2.sql`
- **Core Tables**: 14
- **DC Intelligence File**: `Sandbox/Data/Freemium Scheme/supabase_dc_intelligence.sql`
- **DC Intel Tables**: 4 (dc_operators, dc_countries, dc_facilities, dc_market_summary)
- **Total Tables**: 18
- **Functions**: 4
- **Triggers**: 6 + 4 (DC intel updated_at)

### 2.4 Table Reference

| # | Table | PK Type | Cascade Delete | RLS | Description |
|---|-------|---------|----------------|-----|-------------|
| 1 | `profiles` | TEXT (Firebase UID) | — | service_role | User profiles |
| 2 | `plans` | TEXT | — | public read | Subscription plans (5 seeded) |
| 3 | `subscriptions` | UUID | CASCADE from profiles | FORCE + service_role | User subscriptions |
| 4 | `invoices` | UUID | NO CASCADE (financial) | FORCE + service_role | Payment invoices |
| 5 | `payments` | UUID | NO CASCADE (financial) | FORCE + service_role | Payment records |
| 6 | `entitlements` | TEXT (user_id PK) | CASCADE from profiles | FORCE + service_role | Feature access flags |
| 7 | `projects` | UUID | CASCADE from profiles | service_role | Saved calculator configs |
| 8 | `exports` | UUID | NO CASCADE | service_role | PDF/CSV export records |
| 9 | `webhook_log` | BIGSERIAL | — | service_role | Mayar webhook log |
| 10 | `usage_events` | BIGSERIAL | NO CASCADE | service_role | Calculator usage tracking |
| 11 | `audit_log` | BIGSERIAL | NO CASCADE | service_role | Admin audit trail |
| 12 | `reminder_log` | BIGSERIAL | NO CASCADE | service_role | Email/push reminder log |
| 13 | `fcm_tokens` | UUID | CASCADE from profiles | service_role | Push notification tokens |

### 2.5 Functions

| Function | Type | Description |
|----------|------|-------------|
| `set_updated_at()` | Trigger | Auto-updates `updated_at` column |
| `sync_entitlements()` | Trigger | Syncs entitlements when subscription status changes |
| `process_payment_webhook()` | RPC | Processes Mayar payment webhook atomically |
| `generate_invoice_number()` | RPC | Generates sequential `INV-YYYY-NNNNNN` |
| `reconcile_entitlements()` | RPC | Batch fixes stale subscriptions/entitlements |

### 2.6 Trigger Behavior: sync_entitlements

| Subscription Status | Entitlement Effect |
|---------------------|--------------------|
| `active` (pro plan) | tier=pro, all features enabled, watermark=false |
| `past_due` | can_export_pdf=false, watermark=true (tier stays pro) |
| `cancelled` (period still valid) | No change (grace period) |
| `cancelled` / `expired` (period ended) | Reset to free tier |
| `active` (one_time plan) | Adds export_credits |

### 2.7 Seed Plans

| ID | Name | Tier | Cycle | Price IDR | Price USD |
|----|------|------|-------|-----------|-----------|
| `free` | Free | free | none | 0 | 0 |
| `pro_monthly` | Pro Monthly | pro | monthly | 199,000 | 12.50 |
| `pro_annual` | Pro Annual | pro | annual | 1,990,000 | 125.00 |
| `report_single` | Single PDF Report | pro | one_time | 99,000 | 6.25 |
| `report_comparison` | Comparison Report | pro | one_time | 149,000 | 9.40 |

---

## 3. Backend Configuration

### 3.1 Environment Variables
**File**: `Sandbox/Data/Freemium Scheme/cloud-functions/.env`
**Template**: `cloud-functions/.env.example`

| Variable | Source | Status |
|----------|--------|--------|
| `FIREBASE_PROJECT_ID` | Firebase Console | ✅ Set |
| `FIREBASE_CLIENT_EMAIL` | Service Account JSON | ⚠️ Pending |
| `FIREBASE_PRIVATE_KEY` | Service Account JSON | ⚠️ Pending |
| `SUPABASE_URL` | Supabase Dashboard | ✅ Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard | ✅ Set |
| `MAYAR_API_KEY` | Mayar Dashboard | ✅ Set |
| `MAYAR_WEBHOOK_TOKEN` | Mayar Dashboard | ⚠️ Pending |
| `MAYAR_API_BASE` | — | ✅ `https://api.mayar.id/hl/v1` |
| `RESEND_API_KEY` | Resend Dashboard | ⚠️ Optional |
| `FROM_EMAIL` | — | ✅ Set |
| `PORT` | — | ✅ `8080` |
| `ALLOWED_ORIGINS` | — | ✅ Set |
| `ADMIN_EMAILS` | — | ✅ Set |

### 3.2 Backend File Structure
```
cloud-functions/
├── index.js              # Express app entry point
├── package.json          # Dependencies (v2.0.0)
├── .env                  # Local environment variables
├── .env.example          # Template
├── test-schema.js        # Schema verification (98 tests)
├── middleware/
│   ├── firebase-auth.js  # requireAuth, requireAdmin
│   └── rate-limit.js     # apiLimiter, authLimiter, webhookLimiter, checkoutLimiter
├── routes/
│   ├── auth.js           # /api/me, /api/profile, /api/fcm-token
│   ├── billing.js        # /api/plans, /api/subscriptions, /api/create-checkout
│   ├── webhook.js        # /api/webhook/mayar
│   ├── projects.js       # /api/projects CRUD
│   ├── analytics.js      # /api/usage, /api/exports, /api/dashboard
│   └── admin.js          # /api/reconcile
└── services/
    ├── firebase.js       # Firebase Admin SDK init
    ├── supabase.js       # Supabase client (service_role)
    ├── mayar.js          # Mayar API wrapper
    └── email.js          # Resend email service
```

### 3.3 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | None | Health check |
| GET | `/api/plans` | None | List active plans (public) |
| GET | `/api/me` | Firebase JWT | Profile + entitlements (upserts on first call) |
| PUT | `/api/profile` | Firebase JWT | Update profile fields |
| POST | `/api/fcm-token` | Firebase JWT | Register push notification token |
| GET | `/api/subscriptions` | Firebase JWT | User's subscription history |
| POST | `/api/create-checkout` | Firebase JWT | Create Mayar invoice → checkout URL |
| POST | `/api/webhook/mayar` | Webhook token | Receive Mayar payment webhook |
| GET/POST | `/api/projects` | Firebase JWT | CRUD saved calculator configs |
| PUT/DELETE | `/api/projects/:id` | Firebase JWT | Update/delete project |
| POST | `/api/usage` | Firebase JWT | Log usage event |
| GET | `/api/exports` | Firebase JWT | Export history |
| GET | `/api/dashboard` | Firebase JWT | Aggregated dashboard data |
| POST | `/api/reconcile` | Firebase JWT + Admin | Manual entitlement reconciliation |

---

## 4. Security Notes

### 4.1 RLS (Row Level Security)
- All 13 tables have RLS **enabled**
- Billing-critical tables (subscriptions, invoices, payments, entitlements) have RLS **forced**
- Only `plans` has public read access (for pricing page)
- All other access goes through `service_role` key (backend only)
- Anon key cannot read profiles, subscriptions, invoices, payments, entitlements, projects

### 4.2 Cascade Delete Protection
- Financial records (`invoices`, `payments`, `exports`) do NOT cascade on profile delete
- This preserves audit trail — clean up financial records before deleting a profile
- `subscriptions`, `entitlements`, `projects`, `fcm_tokens` DO cascade

### 4.3 Webhook Security
- Mayar does not support webhook signature verification
- Instead: verify payment status via Mayar API (`GET /invoice/{id}`)
- Webhook dedup via unique constraint on `(provider, provider_event_id)`
- Amount mismatch check in `process_payment_webhook()`

---

## 5. Testing

### 5.1 Schema Test
```bash
cd "Sandbox/Data/Freemium Scheme/cloud-functions"
node test-schema.js
```
- Tests all 14 tables, 4 functions, triggers, RLS, constraints, cascades
- 98 test cases total
- Creates and cleans up test data automatically

### 5.2 Server Test
```bash
cd "Sandbox/Data/Freemium Scheme/cloud-functions"
node index.js
# Server starts on port 8080
# Health check: curl http://localhost:8080/health
# Plans: curl http://localhost:8080/api/plans
```

---

## 6. Pending Actions

| # | Action | Owner | Status |
|---|--------|-------|--------|
| 1 | Enable Firebase Email/Password sign-in | User | ✅ Done |
| 2 | Generate Firebase Service Account Key | User | ✅ Done |
| 3 | Update `.env` with Firebase credentials | Claude | ✅ Done |
| 4 | Grant Service Usage Consumer role to service account | User | ✅ Done |
| 5 | Get Mayar Webhook URL | User | ✅ Done (webhook.site for testing) |
| 6 | (Optional) Sign up for Resend email | User | Optional |
| 7 | Deploy backend to Cloud Run | User | Ready — run `deploy.sh` (see DEPLOY.md) |
| 8 | Implement Mayar Payment Dashboard | Claude | ✅ Done |
| 9 | Update `firebase-config.js` API_BASE after deploy | User | Pending (after #7) |
| 10 | Update Mayar webhook URL to production | User | Pending (after #7) |
| 11 | Redeploy static site after API_BASE update | User | Pending (after #9) |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-17 | Firebase project created (`resistancezero-a1403`), later migrated to `resistancezero-a5ad5` |
| 2026-02-17 | Supabase project created (`bizrikfjfyxtxykuipvv`), Singapore region |
| 2026-02-17 | Schema v2.0.0 executed successfully (14 tables, 4 functions) |
| 2026-02-17 | Backend `.env` created with Supabase + Mayar credentials |
| 2026-02-17 | `.gitignore` updated to exclude `.env` files |
| 2026-02-17 | `dotenv` added to dependencies |
| 2026-02-17 | `firebase.js` updated with graceful credential fallback |
| 2026-02-17 | Schema test suite created (98 tests, all passing) |
| 2026-02-17 | Firebase test suite created (21 tests, all passing, 5 warnings) |
| 2026-02-17 | Firebase project changed to `resistancezero-a5ad5` (project-416280004490) |
| 2026-02-17 | Firebase service account key configured, all 25 tests passing |
| 2026-02-17 | Service Usage Consumer role granted to service account |
| 2026-02-17 | DC Intelligence schema created (4 tables: dc_operators, dc_countries, dc_facilities, dc_market_summary) |
| 2026-02-17 | DC Intelligence data: 50 operators, 28 countries, 35 facilities, 19 market metrics seeded |
| 2026-02-17 | Admin panel benchmarks section rebuilt — 5 sub-tabs, 6 charts, filter/sort/pagination |
| 2026-02-17 | Mayar Payment Dashboard implemented in admin panel (5 tabs, 17 API tools) |
| 2026-02-17 | Cloud Run deployment prepared — deploy.sh, DEPLOY.md, .dockerignore updated |
| 2026-02-17 | Backend verified: all 11 modules load, server starts, 3 services connected |
