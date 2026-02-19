# ResistanceZero SaaS — Schema Changelog

All notable changes to the database schema are documented here.

---

## [1.2.0] - 2026-02-15

### Changed — Tier Simplification: 3-tier → 2-tier (Free + Pro only)
- **Reason**: Streamlined offering for initial launch; enterprise tier deferred to future
- Removed 'enterprise' from all CHECK constraints (plans.tier, entitlements.tier)
- Removed enterprise_monthly and enterprise_annual from seed data (7 plans → 5 plans)
- Updated sync_entitlements(): all `IN ('pro', 'enterprise')` → `= 'pro'`
- Updated reconcile_entitlements(): same simplification
- `can_white_label` and `can_api_access` default FALSE for all tiers (reserved for future)
- Removed unlimited (-1) values; pro max: 100000 kW, 5 projects, 10 exports/day

### Added — Mayar Product Setup Guide
- Created `MAYAR_PRODUCT_SETUP_GUIDE.txt` with complete form fill instructions
- Product tags, tier description, custom form fields, integration notes

---

## [1.1.0] - 2026-02-15

### Changed — Payment Gateway: Xendit → Mayar
- **Reason**: Xendit requires corporate entity (PT/CV); Mayar supports individual accounts (KTP only)
- Renamed all `xendit_*` columns to `mayar_*`:
  - `subscriptions.xendit_customer_id` → `mayar_customer_id` + added `mayar_user_id` (Mayar dual-ID system)
  - `invoices.xendit_invoice_id` → `mayar_invoice_id` + added `mayar_transaction_id`
  - `payments.xendit_payment_id` → `mayar_payment_id`
  - `payments.xendit_invoice_id` → `mayar_invoice_id`
- Added `payments.xendit_transaction_id` — Mayar exposes underlying Xendit reference
- Added `plans.mayar_product_id` — for linking to Mayar membership products
- Updated `webhook_log.provider` default from 'xendit' to 'mayar'
- Updated webhook event types in comments (Mayar uses: `payment.received`, `payment.reminder`, `membership.*`)
- Updated all function parameters and comments to reference Mayar API
- Added comprehensive Mayar webhook handler pattern in end-of-file comments

### Added — Mayar-Specific Documentation
- Mayar API notes in header comments (endpoints, auth, rate limits, sandbox URL)
- Webhook verification pattern (API callback since Mayar has no signature verification)
- Payment method fetch note (not included in webhook — must query API)

### Unchanged
- All table structures, RLS policies, triggers, seed data remain functionally identical
- `process_payment_webhook()` function signature adapted but logic unchanged
- All P0/P1 review fixes still applied

---

## [1.0.0] - 2026-02-15

### Added — Initial Schema (Phase 0)
- 12 tables: profiles, plans, subscriptions, invoices, payments, entitlements, projects, exports, webhook_log, usage_events, audit_log, reminder_log
- PostgreSQL extensions: pgcrypto, citext
- RLS on all tables; FORCE RLS on billing-critical tables (subscriptions, invoices, payments, entitlements)
- Service-role policies for FORCE RLS tables
- Triggers: `handle_new_user()`, `sync_entitlements()`, `set_updated_at()` on all mutable tables
- Functions: `process_payment_webhook()`, `generate_invoice_number()`, `reconcile_entitlements()`
- Seed data: 7 plans (free, pro_monthly, pro_annual, enterprise_monthly, enterprise_annual, report_single, report_comparison)
- All P0/P1 review fixes incorporated:
  - [P0-1] Unique partial index for one active sub per user
  - [P0-2] Trigger fires on INSERT and UPDATE
  - [P0-3] Consistent 'plan' naming
  - [P0-4] Idempotent payment records
  - [P1-1] Auto updated_at triggers
  - [P1-2] Webhook dedup via unique index
  - [P1-3] Usage events table
  - [P1-4] Exports table
  - [P1-5] FORCE RLS on billing tables
  - [P1-6] search_path locked on SECURITY DEFINER functions

---

## File Locations

| File                       | Description                         |
|----------------------------|-------------------------------------|
| `supabase_schema.sql`      | Complete SQL schema (run in Supabase SQL Editor) |
| `SCHEMA_DOCUMENTATION.md`  | Table details, architecture, Mayar integration   |
| `CHANGELOG.md`             | This file — version history         |

## Reference Documents

Original concept and review docs at `C:\Users\User\sandbox for test\freemium concept\`:
- `01_CALCULATOR_USER_MANUAL.md`
- `02_FREEMIUM_STRATEGY.md`
- `03_TECHNICAL_ARCHITECTURE.md` + `03_TECHNICAL_ARCHITECTURE_REVIEW.txt`
- `04_PAYMENT_AND_SUBSCRIPTION_FLOW.md` + `04_PAYMENT_AND_SUBSCRIPTION_FLOW_REVIEW.txt`
- `05_GAP_ANALYSIS_AND_RISK_REGISTER.md`
- `06_IMPLEMENTATION_ROADMAP.md`
- `konsep1.txt` (original concept)
