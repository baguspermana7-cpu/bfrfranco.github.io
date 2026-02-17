# ResistanceZero SaaS — Database Schema Documentation

**Version**: 1.1.0 (Phase 0)
**Last Updated**: 2026-02-15
**Schema File**: `supabase_schema.sql`

---

## Architecture Overview

```
┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Static Frontend │────▶│  Supabase Auth   │────▶│  Supabase DB     │
│  (GitHub Pages)  │     │  + PostgREST     │     │  (PostgreSQL)    │
└──────────────────┘     └─────────────────┘     └──────────────────┘
         │                                               ▲
         │                                               │
         ▼                                               │
┌──────────────────┐     ┌─────────────────┐            │
│  Mayar Payment   │────▶│  Cloud Function  │────────────┘
│  (Webhook)       │     │  (GCloud Run)    │
└──────────────────┘     └─────────────────┘
```

| Component         | Technology                                    |
|-------------------|-----------------------------------------------|
| **Database**      | Supabase PostgreSQL (hosted)                  |
| **Auth**          | Supabase Auth (email/password + Google OAuth) |
| **Backend**       | Google Cloud Run + Cloud Functions             |
| **Region**        | `asia-southeast2` (Jakarta)                   |
| **Payment**       | Mayar (mayar.id) — QRIS/VA/eWallet/Card       |
| **Frontend**      | Static HTML/JS (GitHub Pages)                 |

---

## Table Summary (12 Tables)

| # | Table            | Purpose                                  | RLS | Force RLS |
|---|------------------|------------------------------------------|:---:|:---------:|
| 1 | `profiles`       | User profile (extends auth.users)        | Y   | N         |
| 2 | `plans`          | Pricing plans (free/pro)                 | Y   | N         |
| 3 | `subscriptions`  | User subscription state machine          | Y   | **Y**     |
| 4 | `invoices`       | Payment invoices (Mayar checkout)        | Y   | **Y**     |
| 5 | `payments`       | Payment records (immutable after paid)   | Y   | **Y**     |
| 6 | `entitlements`   | Feature flags — UI source of truth       | Y   | **Y**     |
| 7 | `projects`       | Saved calculator configurations          | Y   | N         |
| 8 | `exports`        | PDF/report generation tracking           | Y   | N         |
| 9 | `webhook_log`    | Incoming webhook audit + dedup           | Y   | N         |
| 10| `usage_events`   | Analytics (calc runs, clicks, views)     | Y   | N         |
| 11| `audit_log`      | Premium action audit trail               | Y   | N         |
| 12| `reminder_log`   | Dunning/renewal reminder tracking        | Y   | N         |

---

## Table Details

### 1. `profiles`
Extends Supabase `auth.users` with application-specific fields. Auto-created via trigger on signup.

| Column           | Type         | Nullable | Default  | Notes                          |
|------------------|--------------|:--------:|----------|--------------------------------|
| `id`             | UUID (PK)    | N        | -        | FK → auth.users(id) CASCADE    |
| `email`          | CITEXT       | N        | -        | UNIQUE, case-insensitive       |
| `full_name`      | TEXT         | Y        | -        |                                |
| `company`        | TEXT         | Y        | -        |                                |
| `country`        | TEXT         | Y        | 'ID'     |                                |
| `phone`          | TEXT         | Y        | -        |                                |
| `avatar_url`     | TEXT         | Y        | -        |                                |
| `invoice_name`   | TEXT         | Y        | -        | For invoice/receipt display     |
| `invoice_address`| TEXT         | Y        | -        | For invoice/receipt display     |
| `created_at`     | TIMESTAMPTZ  | N        | NOW()    |                                |
| `updated_at`     | TIMESTAMPTZ  | N        | NOW()    | Auto via trigger               |

**RLS**: User can read/update own row only.

---

### 2. `plans`
Pricing plans stored in DB — not hardcoded. UI reads from this table for pricing page.

| Column            | Type    | Nullable | Notes                                          |
|-------------------|---------|:--------:|-------------------------------------------------|
| `id`              | TEXT PK | N        | 'free', 'pro_monthly', 'pro_annual', etc.       |
| `name`            | TEXT    | N        | Display name                                    |
| `tier`            | TEXT    | N        | CHECK: 'free', 'pro'                            |
| `billing_cycle`   | TEXT    | N        | CHECK: 'none', 'monthly', 'annual', 'one_time'  |
| `price_idr`       | INTEGER | N        | Price in IDR (e.g., 399000)                     |
| `price_usd`       | INTEGER | Y        | Price in USD cents (e.g., 2500 = $25.00)        |
| `features`        | JSONB   | Y        | Feature flags per plan                          |
| `mayar_product_id`| TEXT    | Y        | Mayar product UUID for membership products      |
| `is_active`       | BOOLEAN | Y        | TRUE = available for purchase                   |
| `sort_order`      | INTEGER | Y        | Display order on pricing page                   |
| `created_at`      | TIMESTAMPTZ | Y    | -                                               |

**Seed data**: 5 plans (free, pro_monthly, pro_annual, report_single, report_comparison)

**RLS**: Public read (anyone can see pricing).

---

### 3. `subscriptions`
One active subscription per user. State machine:

```
                ┌──────────┐
   signup ────▶ │  active   │
                └────┬─────┘
                     │
            ┌────────┴────────┐
            ▼                 ▼
    ┌──────────────┐   ┌───────────┐
    │   past_due   │   │ cancelled │
    │  (grace 3d)  │   │(until end)│
    └──────┬───────┘   └─────┬─────┘
           │                 │
           ▼                 ▼
    ┌──────────────────────────────┐
    │          expired             │
    │   (downgrade to free)       │
    └──────────────────────────────┘
```

| Column                  | Type         | Notes                                      |
|-------------------------|--------------|--------------------------------------------|
| `id`                    | UUID PK      | auto-generated                             |
| `user_id`               | UUID FK      | → profiles(id) CASCADE                     |
| `plan_id`               | TEXT FK      | → plans(id)                                |
| `status`                | TEXT         | 'active', 'past_due', 'cancelled', 'expired' |
| `current_period_start`  | TIMESTAMPTZ  | -                                          |
| `current_period_end`    | TIMESTAMPTZ  | NULL for free plan                         |
| `cancelled_at`          | TIMESTAMPTZ  | When user initiated cancellation           |
| `cancel_reason`         | TEXT         | -                                          |
| `renewal_mode`          | TEXT         | 'manual_qris' or 'auto_card'              |
| `mayar_customer_id`     | TEXT         | Mayar customerId (UUID)                    |
| `mayar_user_id`         | TEXT         | Mayar userId (UUID) — dual-ID system       |

**Constraints**:
- [P0-1] `idx_subs_one_active_per_user`: Only ONE active/past_due subscription per user (partial unique index)

**RLS**: User reads own. Service role has full access (FORCE RLS + service policy).

---

### 4. `invoices`
Every checkout/renewal generates an invoice. Stores Mayar payment link.

| Column                | Type         | Notes                                    |
|-----------------------|--------------|------------------------------------------|
| `id`                  | UUID PK      | auto-generated                           |
| `user_id`             | UUID FK      | → profiles(id)                           |
| `subscription_id`     | UUID FK      | → subscriptions(id), nullable            |
| `plan_id`             | TEXT FK      | → plans(id)                              |
| `invoice_number`      | TEXT UNIQUE  | 'INV-2026-000001' (via sequence)         |
| `amount_idr`          | INTEGER      | Base price before tax                    |
| `tax_idr`             | INTEGER      | PPN 11% (calculated internally)          |
| `total_idr`           | INTEGER      | amount + tax                             |
| `status`              | TEXT         | 'draft', 'sent', 'paid', 'expired', 'cancelled' |
| `kind`                | TEXT         | 'new', 'renewal', 'upgrade', 'purchase' |
| `due_date`            | TIMESTAMPTZ  | -                                        |
| `mayar_invoice_id`    | TEXT         | Mayar invoice UUID                       |
| `mayar_transaction_id`| TEXT         | Mayar transactionId                      |
| `checkout_url`        | TEXT         | Mayar payment link URL                   |
| `external_id`         | TEXT         | Our reference ID sent to Mayar           |
| `idempotency_key`     | TEXT         | Prevent duplicate creation               |

**Constraints**:
- `idx_inv_one_pending_renewal`: Only ONE draft/sent renewal invoice per user at a time

---

### 5. `payments`
Immutable after 'paid'. Stores raw webhook payload for audit.

| Column                  | Type         | Notes                                    |
|-------------------------|--------------|------------------------------------------|
| `id`                    | UUID PK      | auto-generated                           |
| `user_id`               | UUID FK      | → profiles(id)                           |
| `invoice_id`            | UUID FK      | → invoices(id)                           |
| `subscription_id`       | UUID FK      | → subscriptions(id)                      |
| `mayar_payment_id`      | TEXT         | Mayar transaction/payment UUID           |
| `mayar_invoice_id`      | TEXT         | Cross-reference to Mayar invoice         |
| `xendit_transaction_id` | TEXT         | Underlying Xendit ID (Mayar exposes this)|
| `amount_idr`            | INTEGER      | Payment amount                           |
| `payment_method`        | TEXT         | 'qris', 'va_bca', etc. (fetched via API)|
| `status`                | TEXT         | 'pending', 'paid', 'failed', 'refunded', 'expired' |
| `paid_at`               | TIMESTAMPTZ  | -                                        |
| `raw_webhook`           | JSONB        | Full Mayar webhook payload               |

**Constraints**:
- [P0-4] `idx_pay_idempotent`: Only ONE paid record per `mayar_payment_id` (idempotency)

**Important**: Mayar webhook does NOT include `payment_method`. Cloud Function must call `GET /hl/v1/transactions` to fetch this.

---

### 6. `entitlements`
**Source of truth for UI gating.** Frontend checks this table — never reads subscription/plan directly.

| Column              | Type    | Default | Free   | Pro          |
|---------------------|---------|---------|--------|--------------|
| `tier`              | TEXT    | 'free'  | free   | pro          |
| `can_export_pdf`    | BOOLEAN | FALSE   | false  | true         |
| `can_save_projects` | BOOLEAN | FALSE   | false  | true         |
| `can_advanced_mode` | BOOLEAN | FALSE   | false  | true         |
| `can_compare`       | BOOLEAN | FALSE   | false  | true         |
| `can_full_breakdown`| BOOLEAN | FALSE   | false  | true         |
| `can_white_label`   | BOOLEAN | FALSE   | false  | false (future)|
| `can_api_access`    | BOOLEAN | FALSE   | false  | false (future)|
| `max_it_load_kw`    | INTEGER | 5000    | 5000   | 100000       |
| `max_projects`      | INTEGER | 0       | 0      | 5            |
| `max_exports_per_day`| INTEGER| 0       | 0      | 10           |
| `watermark`         | BOOLEAN | TRUE    | true   | false        |
| `export_credits`    | INTEGER | 0       | 0      | (accumulates)|
| `feature_flags`     | JSONB   | {}      | -      | -            |

**Updated by**: `sync_entitlements()` trigger (on subscription change) + nightly `reconcile_entitlements()` job.

---

### 7–12. Supporting Tables

| Table          | Key Purpose                                      |
|----------------|--------------------------------------------------|
| `projects`     | Saved calculator configs (CAPEX/OPEX), max per tier |
| `exports`      | PDF/report generation, download limits, signed URLs |
| `webhook_log`  | Raw webhook storage, dedup via provider_event_id |
| `usage_events` | Analytics: calc_run, export_click, locked_click, page_view |
| `audit_log`    | Premium actions: EXPORT_PDF, SAVE_PROJECT, PAYMENT_SUCCESS |
| `reminder_log` | Dunning/renewal reminders, prevents spam         |

---

## Functions & Triggers

### `handle_new_user()` — Trigger: AFTER INSERT on auth.users
Auto-creates `profiles` row + `entitlements` row (free tier) for every new signup.

### `sync_entitlements()` — Trigger: AFTER INSERT OR UPDATE on subscriptions
Maps subscription status to entitlement flags:
- **active** → full tier entitlements
- **past_due** → restrict exports, add watermark (grace period)
- **cancelled** (within period) → keep existing entitlements
- **expired/cancelled** (past period) → downgrade to free
- **one_time purchase** → increment `export_credits`

### `process_payment_webhook(...)` — RPC function
Atomic transaction called by Cloud Function after receiving + verifying Mayar webhook:
1. Find invoice by `mayar_invoice_id` or `external_id`
2. Validate amount match
3. Check idempotency (already processed?)
4. Update invoice status, insert payment, extend subscription period
5. Log to audit_log

### `reconcile_entitlements()` — Called by Cloud Scheduler (daily)
Nightly cleanup:
1. Active past period_end → past_due
2. Past_due past grace (3 days) → expired
3. Cancelled past period_end → expired
4. Fix tier mismatches between subscription and entitlements

### `generate_invoice_number()` — Called by Cloud Function
Returns sequential invoice number: `INV-2026-000001`

---

## Mayar Integration Notes

### Why Mayar (not Xendit)?
Xendit requires corporate entity (PT/CV). Mayar supports **individual accounts** — only KTP + selfie needed for verification.

### Mayar API Summary

| Endpoint                    | Method | Purpose                       |
|-----------------------------|--------|-------------------------------|
| `/hl/v1/invoice/create`     | POST   | Create invoice + payment link |
| `/hl/v1/invoice/{id}`       | GET    | Verify payment status         |
| `/hl/v1/transactions`       | GET    | Get paid transactions list    |
| `/hl/v1/transactions/unpaid`| GET    | Get unpaid transactions       |
| `/hl/v1/customer/create`    | POST   | Create customer record        |
| `/hl/v1/webhook/register`   | GET    | Register webhook URL          |
| `/hl/v1/qrcode/create`     | POST   | Generate dynamic QRIS         |

### Webhook Events from Mayar

| Event                                   | When                          |
|-----------------------------------------|-------------------------------|
| `payment.received`                      | Customer completes payment    |
| `payment.reminder`                      | 29 min after unpaid invoice   |
| `membership.newMemberRegistered`        | New subscriber                |
| `membership.memberUnsubscribed`         | Member unsubscribes           |
| `membership.memberExpired`              | Membership expires            |
| `membership.changeTierMemberRegistered` | Member changes tier           |

### Critical Mayar Limitations
1. **No webhook signature verification** — must verify via API callback
2. **No refund API** — manual via Mayar dashboard
3. **No payment method in webhook** — must query transactions API
4. **Webhook status is boolean** (true/false), not string — Cloud Function normalizes to 'paid'/'expired'/'failed'
5. **Rate limit**: 20 requests/minute per IP
6. **Subscriptions** created via dashboard, not API — manage via webhook events

### Webhook Verification Pattern
```
Client pays → Mayar sends webhook → Cloud Function receives
  → Log to webhook_log
  → GET /hl/v1/invoice/{id} (verify status = paid)
  → Call process_payment_webhook() RPC
  → Return 200
```

---

## Payment Methods & Fees

| Method         | Fee                    | Settlement |
|----------------|------------------------|------------|
| QRIS           | 0.7%                   | H+3        |
| Bank VA        | Rp 4,000 flat          | Real-time  |
| E-Wallet       | 1.5%                   | H+3        |
| Credit Card    | 2.60% + Rp 2,000      | H+5        |
| Minimarket     | Rp 5,000 – 7,500      | H+5        |

Fees can be charged to customer via `isAdminFeeBorneByCustomer` / `isChannelFeeBorneByCustomer` flags in Mayar API.

---

## Deployment Checklist (Phase 0)

- [ ] Create Supabase project (region: Singapore — closest to Jakarta)
- [ ] Run `supabase_schema.sql` in SQL Editor
- [ ] Enable Auth providers: Email/Password + Google OAuth
- [ ] Configure site URL + redirect URLs
- [ ] Set up SMTP for email verification
- [ ] Create Mayar account + get API keys (sandbox first)
- [ ] Register webhook URL in Mayar dashboard
- [ ] Deploy Cloud Functions on Google Cloud Run (asia-southeast2)
- [ ] Test full flow: signup → checkout → webhook → entitlement activation
