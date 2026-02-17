-- ════════════════════════════════════════════════════════════════════════════
-- RESISTANCEZERO SAAS — COMPLETE SUPABASE DATABASE SCHEMA
-- ════════════════════════════════════════════════════════════════════════════
-- Version : 1.1.0 (Phase 0)
-- Date    : 2026-02-15
-- Target  : Supabase PostgreSQL (hosted)
-- Backend : Google Cloud Run + Cloud Functions (Jakarta asia-southeast2)
-- Payment : Mayar (QRIS/VA/eWallet/Card) — https://mayar.id
-- Auth    : Supabase Auth (email/password + Google OAuth)
--
-- EXECUTION ORDER:
--   1. Extensions
--   2. Helper functions (updated_at trigger)
--   3. Tables (profiles → plans → subscriptions → invoices → payments →
--             entitlements → projects → exports → webhook_log →
--             usage_events → audit_log → reminder_log)
--   4. Indexes
--   5. RLS policies
--   6. Triggers (auth sync, entitlement sync, updated_at)
--   7. Seed data (plans)
--
-- PAYMENT GATEWAY NOTES (Mayar):
--   - Mayar uses UUID for all IDs (not prefixed strings like Xendit)
--   - Dual customer ID: mayar_user_id + mayar_customer_id
--   - Webhook status is BOOLEAN (true/false), not string
--   - No webhook signature verification — validate via API cross-reference
--   - No refund API — refunds processed manually via Mayar dashboard
--   - Payment method NOT included in webhook — query transactions API
--   - Mayar uses Xendit under the hood (xenditTransactionId in responses)
--   - API auth: Bearer token (Authorization: Bearer {API_KEY})
--   - Production: https://api.mayar.id/hl/v1
--   - Sandbox:    https://api.mayar.club/hl/v1
--   - Rate limit: 20 req/min per IP
--
-- P0/P1 REVIEW FIXES APPLIED:
--   [P0-1] UNIQUE partial index on subscriptions(user_id) WHERE active/past_due
--   [P0-2] Trigger AFTER INSERT OR UPDATE (not just UPDATE)
--   [P0-3] Consistent 'plan' naming (no 'tier' confusion in schema)
--   [P0-4] UNIQUE on payments.mayar_payment_id (idempotency)
--   [P1-1] updated_at auto-trigger on all mutable tables
--   [P1-2] webhook_log with UNIQUE provider_event_id (replay protection)
--   [P1-3] usage_events for analytics
--   [P1-4] exports table for PDF/report tracking
--   [P1-5] FORCE RLS on billing-critical tables
--   [P1-6] search_path locked on SECURITY DEFINER functions
-- ════════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════
-- 1. EXTENSIONS
-- ══════════════════════════════
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive email comparisons


-- ══════════════════════════════
-- 2. HELPER: Reusable updated_at trigger function
-- ══════════════════════════════
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ══════════════════════════════
-- 3. TABLES
-- ══════════════════════════════

-- ─── 3.1 PROFILES ───────────────────────────────────────────────────────────
-- Extends auth.users with app-specific fields.
-- Auto-created via trigger on auth.users INSERT.
CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       CITEXT NOT NULL UNIQUE,     -- CITEXT for case-insensitive; synced from auth.users
    full_name   TEXT,
    company     TEXT,
    country     TEXT DEFAULT 'ID',
    phone       TEXT,
    avatar_url  TEXT,
    invoice_name TEXT,                       -- [P1] optional name for invoices/receipts
    invoice_address TEXT,                    -- [P1] optional address for invoices
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_set_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 3.2 PLANS ──────────────────────────────────────────────────────────────
-- Pricing plans. Not hardcoded in app code — UI reads from this table.
-- billing_cycle='none' for free pseudo-plan (no checkout).
CREATE TABLE plans (
    id              TEXT PRIMARY KEY,        -- 'pro_monthly', 'pro_annual', etc.
    name            TEXT NOT NULL,           -- 'Pro Monthly'
    tier            TEXT NOT NULL CHECK (tier IN ('free', 'pro')),
    billing_cycle   TEXT NOT NULL CHECK (billing_cycle IN ('none', 'monthly', 'annual', 'one_time')),
    price_idr       INTEGER NOT NULL,        -- 399000, 3199000, etc.
    price_usd       INTEGER DEFAULT 0,       -- cents: 2500, 20200
    features        JSONB,                   -- per-plan feature flags (drives entitlement computation)
    mayar_product_id TEXT,                   -- Mayar product UUID (for membership/subscription products)
    is_active       BOOLEAN DEFAULT TRUE,    -- soft-disable plans without deleting
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 3.3 SUBSCRIPTIONS ─────────────────────────────────────────────────────
-- One active subscription per user. State machine:
--   active → past_due → expired
--   active → cancelled (keeps access until period_end) → expired
CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id                 TEXT NOT NULL REFERENCES plans(id),
    status                  TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'past_due', 'cancelled', 'expired')),
    current_period_start    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end      TIMESTAMPTZ,     -- NOT NULL for paid plans; NULL for free
    cancelled_at            TIMESTAMPTZ,
    cancel_reason           TEXT,
    renewal_mode            TEXT DEFAULT 'manual_qris'
        CHECK (renewal_mode IN ('manual_qris', 'auto_card')),
    -- Mayar customer references (dual-ID system)
    mayar_customer_id       TEXT,            -- Mayar customerId (UUID string)
    mayar_user_id           TEXT,            -- Mayar userId (UUID string)
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- [P0-1] Only one active/past_due subscription per user at a time
CREATE UNIQUE INDEX idx_subs_one_active_per_user
    ON subscriptions(user_id) WHERE status IN ('active', 'past_due');

CREATE INDEX idx_subs_user       ON subscriptions(user_id);
CREATE INDEX idx_subs_status     ON subscriptions(status);
CREATE INDEX idx_subs_period_end ON subscriptions(current_period_end);

CREATE TRIGGER subscriptions_set_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 3.4 INVOICES ───────────────────────────────────────────────────────────
-- Every checkout/renewal creates an invoice. Mayar payment URL stored here.
CREATE TABLE invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES profiles(id),
    subscription_id     UUID REFERENCES subscriptions(id),
    plan_id             TEXT NOT NULL REFERENCES plans(id),
    invoice_number      TEXT UNIQUE,         -- 'INV-2026-0001' (generated via sequence)
    amount_idr          INTEGER NOT NULL,    -- base price
    tax_idr             INTEGER NOT NULL DEFAULT 0,  -- PPN 11% (handle internally, NOT via Mayar fees)
    total_idr           INTEGER NOT NULL,    -- amount + tax
    status              TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'paid', 'expired', 'cancelled')),
    kind                TEXT NOT NULL DEFAULT 'new'
        CHECK (kind IN ('new', 'renewal', 'upgrade', 'purchase')),
    due_date            TIMESTAMPTZ,
    -- Mayar references
    mayar_invoice_id    TEXT,                -- Mayar invoice UUID from /invoice/create response
    mayar_transaction_id TEXT,               -- Mayar transactionId from response
    checkout_url        TEXT,                -- Mayar payment link URL
    external_id         TEXT,                -- our reference ID sent to Mayar (via description)
    idempotency_key     TEXT,                -- prevent duplicate invoice creation
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inv_user    ON invoices(user_id);
CREATE INDEX idx_inv_mayar   ON invoices(mayar_invoice_id);
CREATE INDEX idx_inv_status  ON invoices(status);
CREATE INDEX idx_inv_ext_id  ON invoices(external_id);

-- [P1] Prevent duplicate pending renewal invoices per user
CREATE UNIQUE INDEX idx_inv_one_pending_renewal
    ON invoices(user_id, kind) WHERE status IN ('draft', 'sent') AND kind = 'renewal';

-- Sequence for invoice numbers
CREATE SEQUENCE invoice_number_seq START 1;
-- Usage in Cloud Function:
--   SELECT 'INV-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 6, '0');

CREATE TRIGGER invoices_set_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 3.5 PAYMENTS ───────────────────────────────────────────────────────────
-- Immutable after 'paid'. Raw webhook payload stored for audit.
-- NOTE: Mayar webhook does NOT include payment_method — fetch via API if needed.
CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES profiles(id),
    invoice_id          UUID REFERENCES invoices(id),
    subscription_id     UUID REFERENCES subscriptions(id),
    -- Mayar references
    mayar_payment_id    TEXT,                -- Mayar transaction/payment UUID
    mayar_invoice_id    TEXT,                -- Cross-reference to Mayar invoice
    xendit_transaction_id TEXT,              -- Underlying Xendit ID (Mayar exposes this)
    amount_idr          INTEGER NOT NULL,
    payment_method      TEXT,                -- 'qris', 'va_bca', 'ewallet_gopay', 'card_visa'
                                             -- NOTE: Must be fetched via Mayar API, not from webhook
    status              TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'expired')),
    paid_at             TIMESTAMPTZ,
    raw_webhook         JSONB,               -- full Mayar webhook payload
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pay_user   ON payments(user_id);
CREATE INDEX idx_pay_mayar  ON payments(mayar_payment_id);
CREATE INDEX idx_pay_inv    ON payments(invoice_id);

-- [P0-4] Idempotency: only one 'paid' record per mayar_payment_id
CREATE UNIQUE INDEX idx_pay_idempotent
    ON payments(mayar_payment_id) WHERE status = 'paid';


-- ─── 3.6 ENTITLEMENTS ──────────────────────────────────────────────────────
-- Source of truth for UI gating. UI checks THIS, not plan/subscription directly.
-- Updated via trigger on subscriptions change + nightly reconciliation job.
CREATE TABLE entitlements (
    user_id             UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    tier                TEXT NOT NULL DEFAULT 'free'
        CHECK (tier IN ('free', 'pro')),
    can_export_pdf      BOOLEAN DEFAULT FALSE,
    can_save_projects   BOOLEAN DEFAULT FALSE,
    can_advanced_mode   BOOLEAN DEFAULT FALSE,
    can_compare         BOOLEAN DEFAULT FALSE,
    can_full_breakdown  BOOLEAN DEFAULT FALSE,
    can_white_label     BOOLEAN DEFAULT FALSE,
    can_api_access      BOOLEAN DEFAULT FALSE,
    max_it_load_kw      INTEGER DEFAULT 5000,    -- free=5000, pro=100000
    max_projects        INTEGER DEFAULT 0,        -- 0=none, 5=pro, -1=unlimited
    max_exports_per_day INTEGER DEFAULT 0,        -- 0=none, 10=pro, -1=unlimited
    watermark           BOOLEAN DEFAULT TRUE,     -- true for free
    export_credits      INTEGER DEFAULT 0,        -- per-report purchases (atomic decrement)
    calc_version_access TEXT,                      -- 'v2' etc.
    feature_flags       JSONB DEFAULT '{}'::jsonb, -- future expansion without schema changes
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER entitlements_set_updated_at
    BEFORE UPDATE ON entitlements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 3.7 PROJECTS ───────────────────────────────────────────────────────────
-- Saved calculator configurations (Pro: max 5).
CREATE TABLE projects (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    calculator_type   TEXT NOT NULL CHECK (calculator_type IN ('capex', 'opex')),
    name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    config            JSONB NOT NULL,        -- all input parameters
    config_hash       TEXT,                  -- SHA-256 for caching/dedup
    calc_version      TEXT,                  -- e.g. 'v1.0'
    results           JSONB,                 -- cached calculation output
    is_scenario_a     BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proj_user ON projects(user_id);

CREATE TRIGGER projects_set_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 3.8 EXPORTS ────────────────────────────────────────────────────────────
-- Tracks PDF/report generation. Signed URL served to user with short TTL.
CREATE TABLE exports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES profiles(id),
    project_id      UUID REFERENCES projects(id),
    calculator_type TEXT NOT NULL CHECK (calculator_type IN ('capex', 'opex')),
    export_type     TEXT NOT NULL DEFAULT 'pdf' CHECK (export_type IN ('pdf', 'png', 'csv')),
    status          TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'generating', 'ready', 'failed', 'expired')),
    storage_path    TEXT,                    -- Supabase Storage path or GCS path
    config_snapshot JSONB,                   -- inputs at time of export (immutable audit)
    calc_version    TEXT,
    download_count  INTEGER DEFAULT 0,
    max_downloads   INTEGER DEFAULT 3,       -- enforce download limit
    expires_at      TIMESTAMPTZ,             -- signed URL expiry
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exports_user ON exports(user_id);


-- ─── 3.9 WEBHOOK LOG ────────────────────────────────────────────────────────
-- [P1-2] Every incoming webhook stored for audit + replay protection.
-- NOTE: Mayar has NO webhook signature verification.
-- Validate webhooks by cross-referencing data with Mayar API.
CREATE TABLE webhook_log (
    id                  BIGSERIAL PRIMARY KEY,
    provider            TEXT NOT NULL DEFAULT 'mayar',
    provider_event_id   TEXT,                -- Mayar webhook delivery ID (from history API)
    event_type          TEXT NOT NULL,        -- 'payment.received', 'payment.reminder',
                                             -- 'membership.newMemberRegistered',
                                             -- 'membership.memberUnsubscribed',
                                             -- 'membership.memberExpired',
                                             -- 'membership.changeTierMemberRegistered'
    status              TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
    raw_payload         JSONB NOT NULL,
    error_message       TEXT,
    processed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotency: reject duplicate webhook events
CREATE UNIQUE INDEX idx_webhook_dedup
    ON webhook_log(provider, provider_event_id) WHERE provider_event_id IS NOT NULL;

CREATE INDEX idx_webhook_created ON webhook_log(created_at);


-- ─── 3.10 USAGE EVENTS ─────────────────────────────────────────────────────
-- [P1-3] Analytics: calc runs, feature clicks, locked-feature clicks, exports.
CREATE TABLE usage_events (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES profiles(id),   -- NULL for anonymous
    event_type  TEXT NOT NULL,                    -- 'calc_run', 'export_click', 'locked_click', 'page_view'
    calculator  TEXT,                             -- 'capex', 'opex'
    metadata    JSONB,                           -- { it_load: 5000, country: 'ID', ... }
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_user    ON usage_events(user_id);
CREATE INDEX idx_usage_type    ON usage_events(event_type);
CREATE INDEX idx_usage_created ON usage_events(created_at);


-- ─── 3.11 AUDIT LOG ────────────────────────────────────────────────────────
-- Premium actions: export, save, upgrade, tier_change, login, etc.
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID REFERENCES profiles(id),
    action      TEXT NOT NULL,               -- 'EXPORT_PDF', 'SAVE_PROJECT', 'UPGRADE_PLAN', 'PAYMENT_SUCCESS'
    detail      JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user    ON audit_log(user_id);
CREATE INDEX idx_audit_action  ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at);


-- ─── 3.12 REMINDER LOG ─────────────────────────────────────────────────────
-- Track dunning/renewal reminders to prevent spam.
-- NOTE: Mayar sends automatic payment.reminder webhook after 29 min unpaid.
-- This table tracks OUR custom reminders (email/WhatsApp dunning).
CREATE TABLE reminder_log (
    id                BIGSERIAL PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES profiles(id),
    subscription_id   UUID REFERENCES subscriptions(id),
    invoice_id        UUID REFERENCES invoices(id),
    channel           TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'push')),
    reminder_type     TEXT NOT NULL,          -- 'renewal_h7', 'renewal_h3', 'renewal_h1', 'expired', 'dunning_d1', 'dunning_d3'
    sent_at           TIMESTAMPTZ DEFAULT NOW(),
    delivered         BOOLEAN DEFAULT FALSE,
    metadata          JSONB
);

CREATE INDEX idx_reminder_user    ON reminder_log(user_id);
CREATE INDEX idx_reminder_sent_at ON reminder_log(sent_at);


-- ══════════════════════════════
-- 4. ROW LEVEL SECURITY (RLS)
-- ══════════════════════════════

-- Enable RLS on ALL tables
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_log  ENABLE ROW LEVEL SECURITY;

-- [P1-5] FORCE RLS on billing-critical tables (prevents bypass even by privileged roles)
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices      FORCE ROW LEVEL SECURITY;
ALTER TABLE payments      FORCE ROW LEVEL SECURITY;
ALTER TABLE entitlements  FORCE ROW LEVEL SECURITY;

-- ── User-facing policies ──

-- profiles: user can read/update their own row
CREATE POLICY "profiles_own" ON profiles
    FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- plans: public read (pricing page)
CREATE POLICY "plans_public_read" ON plans
    FOR SELECT USING (true);

-- subscriptions: user reads own
CREATE POLICY "subs_own_read" ON subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- invoices: user reads own
CREATE POLICY "invoices_own_read" ON invoices
    FOR SELECT USING (auth.uid() = user_id);

-- payments: user reads own
CREATE POLICY "payments_own_read" ON payments
    FOR SELECT USING (auth.uid() = user_id);

-- entitlements: user reads own
CREATE POLICY "entitlements_own_read" ON entitlements
    FOR SELECT USING (auth.uid() = user_id);

-- projects: full CRUD on own projects
CREATE POLICY "projects_own" ON projects
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- exports: user reads own
CREATE POLICY "exports_own_read" ON exports
    FOR SELECT USING (auth.uid() = user_id);

-- usage_events: authenticated users can INSERT their own events
CREATE POLICY "usage_own_insert" ON usage_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "usage_own_read" ON usage_events
    FOR SELECT USING (auth.uid() = user_id);

-- webhook_log: service_role only (no user policy)
-- audit_log: service_role only (no user policy)
-- reminder_log: service_role only (no user policy)

-- NOTE: Cloud Functions use SUPABASE_SERVICE_ROLE_KEY to write to
-- subscriptions, invoices, payments, entitlements, webhook_log,
-- audit_log, reminder_log. Service role bypasses RLS unless FORCE RLS
-- is set. For FORCE RLS tables, create service-role policies:
CREATE POLICY "service_subs_all" ON subscriptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_invoices_all" ON invoices
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_payments_all" ON payments
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_entitlements_all" ON entitlements
    FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ══════════════════════════════
-- 5. TRIGGERS & FUNCTIONS
-- ══════════════════════════════

-- ─── 5.1 Auto-create profile + free entitlements on user signup ─────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    -- Create free-tier entitlements
    INSERT INTO entitlements (user_id, tier) VALUES (NEW.id, 'free');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_temp;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─── 5.2 Sync entitlements on subscription change ──────────────────────────
-- [P0-2] Fires on BOTH INSERT and UPDATE.
CREATE OR REPLACE FUNCTION sync_entitlements()
RETURNS TRIGGER AS $$
DECLARE
    plan_record RECORD;
BEGIN
    SELECT * INTO plan_record FROM plans WHERE id = NEW.plan_id;

    -- ACTIVE: grant full tier entitlements
    IF NEW.status = 'active' THEN
        INSERT INTO entitlements (
            user_id, tier, can_export_pdf, can_save_projects,
            can_advanced_mode, can_compare, can_full_breakdown,
            can_white_label, can_api_access,
            max_it_load_kw, max_projects, max_exports_per_day,
            watermark, calc_version_access, updated_at
        ) VALUES (
            NEW.user_id,
            plan_record.tier,
            plan_record.tier = 'pro',    -- can_export_pdf
            plan_record.tier = 'pro',    -- can_save_projects
            plan_record.tier = 'pro',    -- can_advanced_mode
            plan_record.tier = 'pro',    -- can_compare
            plan_record.tier = 'pro',    -- can_full_breakdown
            FALSE,                       -- can_white_label (future)
            FALSE,                       -- can_api_access (future)
            CASE plan_record.tier WHEN 'free' THEN 5000 ELSE 100000 END,
            CASE plan_record.tier WHEN 'free' THEN 0 ELSE 5 END,
            CASE plan_record.tier WHEN 'free' THEN 0 ELSE 10 END,
            plan_record.tier = 'free',
            NULL,
            NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
            tier                = EXCLUDED.tier,
            can_export_pdf      = EXCLUDED.can_export_pdf,
            can_save_projects   = EXCLUDED.can_save_projects,
            can_advanced_mode   = EXCLUDED.can_advanced_mode,
            can_compare         = EXCLUDED.can_compare,
            can_full_breakdown  = EXCLUDED.can_full_breakdown,
            can_white_label     = EXCLUDED.can_white_label,
            can_api_access      = EXCLUDED.can_api_access,
            max_it_load_kw      = EXCLUDED.max_it_load_kw,
            max_projects        = EXCLUDED.max_projects,
            max_exports_per_day = EXCLUDED.max_exports_per_day,
            watermark           = EXCLUDED.watermark,
            calc_version_access = EXCLUDED.calc_version_access,
            updated_at          = NOW();

    -- PAST_DUE: restrict exports/watermark, keep other features during grace
    ELSIF NEW.status = 'past_due' THEN
        UPDATE entitlements SET
            can_export_pdf = FALSE,
            watermark      = TRUE,
            updated_at     = NOW()
        WHERE user_id = NEW.user_id;

    -- CANCELLED but still within paid period: do NOT downgrade yet
    -- Nightly reconciliation job handles downgrade after period_end
    ELSIF NEW.status = 'cancelled'
      AND NEW.current_period_end IS NOT NULL
      AND NEW.current_period_end >= NOW() THEN
        NULL;  -- keep existing entitlements

    -- EXPIRED or CANCELLED past period_end: downgrade to free
    ELSIF NEW.status IN ('expired', 'cancelled')
      AND (NEW.current_period_end IS NULL OR NEW.current_period_end < NOW()) THEN
        UPDATE entitlements SET
            tier                = 'free',
            can_export_pdf      = FALSE,
            can_save_projects   = FALSE,
            can_advanced_mode   = FALSE,
            can_compare         = FALSE,
            can_full_breakdown  = FALSE,
            can_white_label     = FALSE,
            can_api_access      = FALSE,
            max_it_load_kw      = 5000,
            max_projects        = 0,
            max_exports_per_day = 0,
            watermark           = TRUE,
            export_credits      = export_credits,  -- keep existing credits
            calc_version_access = NULL,
            updated_at          = NOW()
        WHERE user_id = NEW.user_id;
    END IF;

    -- Handle one-time report credits (per-report purchase)
    IF plan_record.billing_cycle = 'one_time' AND NEW.status = 'active' THEN
        UPDATE entitlements SET
            export_credits = export_credits + COALESCE((plan_record.features->>'credits')::integer, 1),
            updated_at     = NOW()
        WHERE user_id = NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_temp;

-- [P0-2] AFTER INSERT OR UPDATE — not just UPDATE
CREATE TRIGGER on_subscription_change
    AFTER INSERT OR UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION sync_entitlements();


-- ─── 5.3 Process payment webhook (atomic transaction) ──────────────────────
-- Called from Cloud Function via supabase.rpc('process_payment_webhook', {...})
-- Wraps invoice update + payment insert + subscription extend in one transaction.
--
-- MAYAR WEBHOOK NOTES:
--   - Mayar sends 'payment.received' event with boolean status (true = paid)
--   - Payment method is NOT in the webhook — Cloud Function must call
--     GET /hl/v1/transactions to fetch payment_method if needed
--   - No webhook signature verification — Cloud Function should call
--     GET /hl/v1/invoice/{id} to verify payment status before trusting webhook
--   - Mayar exposes underlying xenditTransactionId in API responses
CREATE OR REPLACE FUNCTION process_payment_webhook(
    p_mayar_invoice_id TEXT,
    p_external_id TEXT,
    p_status TEXT,           -- 'paid', 'expired', 'failed' (normalized by Cloud Function)
    p_payment_id TEXT,       -- Mayar transaction/payment UUID
    p_payment_method TEXT,   -- fetched via Mayar API by Cloud Function (may be NULL)
    p_amount INTEGER,
    p_raw_webhook JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_invoice RECORD;
    v_payment_id UUID;
    v_result JSONB;
BEGIN
    -- 1. Find the invoice
    SELECT * INTO v_invoice FROM invoices
    WHERE mayar_invoice_id = p_mayar_invoice_id
       OR external_id = p_external_id
    LIMIT 1;

    IF v_invoice IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Invoice not found');
    END IF;

    -- 2. Validate: amount must match
    IF p_status = 'paid' AND p_amount != v_invoice.total_idr THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Amount mismatch');
    END IF;

    -- 3. Check idempotency: invoice already in terminal state
    IF v_invoice.status IN ('paid', 'expired', 'cancelled') THEN
        RETURN jsonb_build_object('ok', true, 'message', 'Already processed');
    END IF;

    -- 4. Handle PAID
    IF p_status = 'paid' THEN
        -- Update invoice
        UPDATE invoices SET status = 'paid', updated_at = NOW()
        WHERE id = v_invoice.id AND status NOT IN ('paid');

        -- Insert payment (idempotent via unique index on mayar_payment_id)
        INSERT INTO payments (user_id, invoice_id, subscription_id,
            mayar_payment_id, mayar_invoice_id, amount_idr,
            payment_method, status, paid_at, raw_webhook)
        VALUES (v_invoice.user_id, v_invoice.id, v_invoice.subscription_id,
            p_payment_id, p_mayar_invoice_id, p_amount,
            p_payment_method, 'paid', NOW(), p_raw_webhook)
        ON CONFLICT DO NOTHING;

        -- Extend subscription (calendar-based: +1 month or +1 year)
        IF v_invoice.subscription_id IS NOT NULL THEN
            UPDATE subscriptions SET
                status = 'active',
                current_period_start = COALESCE(
                    CASE WHEN current_period_end > NOW() THEN current_period_end ELSE NOW() END,
                    NOW()
                ),
                current_period_end = CASE
                    WHEN (SELECT billing_cycle FROM plans WHERE id = v_invoice.plan_id) = 'monthly'
                        THEN COALESCE(
                            CASE WHEN current_period_end > NOW() THEN current_period_end ELSE NOW() END,
                            NOW()
                        ) + INTERVAL '1 month'
                    WHEN (SELECT billing_cycle FROM plans WHERE id = v_invoice.plan_id) = 'annual'
                        THEN COALESCE(
                            CASE WHEN current_period_end > NOW() THEN current_period_end ELSE NOW() END,
                            NOW()
                        ) + INTERVAL '1 year'
                    ELSE current_period_end
                END,
                updated_at = NOW()
            WHERE id = v_invoice.subscription_id;
        END IF;

        -- Audit log
        INSERT INTO audit_log (user_id, action, detail)
        VALUES (v_invoice.user_id, 'PAYMENT_SUCCESS', jsonb_build_object(
            'invoice_id', v_invoice.id,
            'amount', p_amount,
            'method', p_payment_method,
            'plan', v_invoice.plan_id
        ));

        v_result := jsonb_build_object('ok', true, 'action', 'activated');

    -- 5. Handle EXPIRED
    ELSIF p_status = 'expired' THEN
        UPDATE invoices SET status = 'expired', updated_at = NOW()
        WHERE id = v_invoice.id AND status NOT IN ('paid', 'expired');
        v_result := jsonb_build_object('ok', true, 'action', 'expired');

    -- 6. Handle FAILED
    ELSIF p_status = 'failed' THEN
        INSERT INTO payments (user_id, invoice_id, mayar_payment_id,
            mayar_invoice_id, amount_idr, payment_method, status, raw_webhook)
        VALUES (v_invoice.user_id, v_invoice.id, p_payment_id,
            p_mayar_invoice_id, p_amount, p_payment_method, 'failed', p_raw_webhook)
        ON CONFLICT DO NOTHING;
        v_result := jsonb_build_object('ok', true, 'action', 'failed_recorded');

    ELSE
        v_result := jsonb_build_object('ok', false, 'error', 'Unknown status: ' || p_status);
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_temp;


-- ─── 5.4 Generate invoice number (called from Cloud Function) ──────────────
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'INV-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 6, '0');
END;
$$ LANGUAGE plpgsql;


-- ─── 5.5 Reconcile entitlements (called by nightly Cloud Scheduler job) ─────
-- Fixes drift: compares subscriptions vs entitlements and corrects mismatches.
CREATE OR REPLACE FUNCTION reconcile_entitlements()
RETURNS TABLE(user_id UUID, action TEXT) AS $$
BEGIN
    -- 1. Active subs past period_end and not renewed → past_due
    RETURN QUERY
    UPDATE subscriptions s SET status = 'past_due', updated_at = NOW()
    WHERE s.status = 'active'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end < NOW()
      AND s.plan_id != 'free'
    RETURNING s.user_id, 'set_past_due'::TEXT;

    -- 2. Past_due past grace period (3 days) → expired + downgrade
    RETURN QUERY
    UPDATE subscriptions s SET status = 'expired', updated_at = NOW()
    WHERE s.status = 'past_due'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end + INTERVAL '3 days' < NOW()
    RETURNING s.user_id, 'expired_after_grace'::TEXT;

    -- 3. Cancelled past period_end → expired
    RETURN QUERY
    UPDATE subscriptions s SET status = 'expired', updated_at = NOW()
    WHERE s.status = 'cancelled'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end < NOW()
    RETURNING s.user_id, 'cancelled_expired'::TEXT;

    -- 4. Entitlement tier doesn't match active subscription → fix
    RETURN QUERY
    UPDATE entitlements e SET
        tier = p.tier,
        can_export_pdf      = (p.tier = 'pro'),
        can_save_projects   = (p.tier = 'pro'),
        can_advanced_mode   = (p.tier = 'pro'),
        can_compare         = (p.tier = 'pro'),
        can_full_breakdown  = (p.tier = 'pro'),
        max_it_load_kw      = CASE p.tier WHEN 'free' THEN 5000 ELSE 100000 END,
        max_projects        = CASE p.tier WHEN 'free' THEN 0 ELSE 5 END,
        watermark           = (p.tier = 'free'),
        max_exports_per_day = CASE p.tier WHEN 'free' THEN 0 ELSE 10 END,
        updated_at          = NOW()
    FROM subscriptions s
    JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = e.user_id
      AND s.status = 'active'
      AND e.tier != p.tier
    RETURNING e.user_id, 'tier_corrected'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_temp;


-- ══════════════════════════════
-- 6. SEED DATA
-- ══════════════════════════════

-- Default plans (pricing from Doc 02)
INSERT INTO plans (id, name, tier, billing_cycle, price_idr, price_usd, features, sort_order) VALUES
    ('free', 'Free', 'free', 'none', 0, 0,
     '{"can_export_pdf":false,"can_save_projects":false,"can_advanced_mode":false,"can_compare":false,"can_full_breakdown":false,"max_it_load_kw":5000,"max_projects":0,"watermark":true,"max_exports_per_day":0}'::jsonb,
     0),
    ('pro_monthly', 'Pro Monthly', 'pro', 'monthly', 199000, 1250,
     '{"can_export_pdf":true,"can_save_projects":true,"can_advanced_mode":true,"can_compare":true,"can_full_breakdown":true,"max_it_load_kw":100000,"max_projects":5,"watermark":false,"max_exports_per_day":10}'::jsonb,
     1),
    ('pro_annual', 'Pro Annual', 'pro', 'annual', 1990000, 12500,
     '{"can_export_pdf":true,"can_save_projects":true,"can_advanced_mode":true,"can_compare":true,"can_full_breakdown":true,"max_it_load_kw":100000,"max_projects":5,"watermark":false,"max_exports_per_day":10}'::jsonb,
     2),
    ('report_single', 'Single PDF Report', 'pro', 'one_time', 99000, 625,
     '{"credits":1}'::jsonb,
     10),
    ('report_comparison', 'Comparison Report', 'pro', 'one_time', 149000, 940,
     '{"credits":1}'::jsonb,
     11);


-- ══════════════════════════════
-- DONE. Schema ready for Supabase deployment.
-- ══════════════════════════════
--
-- NEXT STEPS (Cloud Functions on Google Cloud Run):
--   1. POST /api/me            — return user profile + entitlements (JWT verified)
--   2. POST /api/create-checkout — create Mayar invoice via POST /hl/v1/invoice/create
--                                  → store mayar_invoice_id + checkout_url in invoices table
--   3. POST /api/webhook/mayar — receive webhook, log to webhook_log,
--                                 verify via GET /hl/v1/invoice/{id},
--                                 then call process_payment_webhook()
--   4. Cloud Scheduler daily   — call reconcile_entitlements() + generate renewal invoices
--
-- MAYAR WEBHOOK HANDLER PATTERN (Cloud Function pseudocode):
--   1. Receive POST from Mayar (event: 'payment.received')
--   2. Log raw payload to webhook_log
--   3. Extract data.id (Mayar invoice/payment ID)
--   4. VERIFY: Call GET /hl/v1/invoice/{id} with Bearer token
--      → Confirm status is actually 'paid' (since no webhook signature)
--   5. If verified, normalize status boolean → 'paid'/'expired'/'failed' string
--   6. Optionally GET /hl/v1/transactions to fetch payment_method
--   7. Call supabase.rpc('process_payment_webhook', { ... })
--   8. Return 200 to Mayar
--
-- SUPABASE CONFIG:
--   - Auth providers: Email/Password + Google OAuth
--   - Site URL: https://resistancezero.com
--   - Redirect URLs: https://resistancezero.com/*, https://website-bagus-*.run.app/*
--   - CORS: allow resistancezero.com + Cloud Run domains
--   - SMTP: configure for email verification + password reset
