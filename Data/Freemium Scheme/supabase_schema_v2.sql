-- ════════════════════════════════════════════════════════════════════════════
-- RESISTANCEZERO SAAS — SUPABASE DATABASE SCHEMA v2.0.0
-- ════════════════════════════════════════════════════════════════════════════
-- Version : 2.0.0
-- Date    : 2026-02-16
-- Target  : Supabase PostgreSQL (hosted)
-- Backend : Google Cloud Run + Express API (Jakarta asia-southeast2)
-- Payment : Mayar (QRIS/VA/eWallet/Card) — https://mayar.id
-- Auth    : Firebase Auth (Email/Password + Google OAuth)
--           → Supabase used as DB only (no Supabase Auth)
--
-- BREAKING CHANGES FROM v1.1.0:
--   1. profiles.id: UUID (auth.users FK) → TEXT (Firebase UID)
--   2. All user_id FKs: UUID → TEXT
--   3. handle_new_user() trigger REMOVED (Cloud Run upserts on /api/me)
--   4. auth.uid() RLS policies → service_role-only (Cloud Run mediates)
--   5. NEW TABLE: fcm_tokens (Firebase Cloud Messaging)
--   6. Updated sync_entitlements() for TEXT user_id
--   7. Updated RLS: user-facing reads go through Cloud Run (service_role)
--
-- MIGRATION PATH (from v1.1.0):
--   Run the migration section at the bottom of this file AFTER backing up.
--
-- EXECUTION ORDER:
--   1. Extensions
--   2. Helper functions
--   3. Tables (profiles → plans → subscriptions → invoices → payments →
--             entitlements → projects → exports → webhook_log →
--             usage_events → audit_log → reminder_log → fcm_tokens)
--   4. Indexes
--   5. RLS policies
--   6. Triggers (entitlement sync, updated_at)
--   7. RPC functions (payment webhook, reconciliation, invoice number)
--   8. Seed data
-- ════════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════
-- 1. EXTENSIONS
-- ══════════════════════════════
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;


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
-- User profile. ID = Firebase UID (text string like "abc123xyz").
-- Created via Cloud Run upsert on first GET /api/me call.
-- NO trigger on auth.users — Firebase Auth is external.
CREATE TABLE profiles (
    id          TEXT PRIMARY KEY,              -- Firebase UID
    email       CITEXT NOT NULL UNIQUE,
    full_name   TEXT,
    company     TEXT,
    country     TEXT DEFAULT 'ID',
    phone       TEXT,
    avatar_url  TEXT,
    invoice_name    TEXT,
    invoice_address TEXT,
    firebase_provider TEXT,                    -- 'password', 'google.com', etc.
    last_login_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_set_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 3.2 PLANS ──────────────────────────────────────────────────────────────
CREATE TABLE plans (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    tier            TEXT NOT NULL CHECK (tier IN ('free', 'pro')),
    billing_cycle   TEXT NOT NULL CHECK (billing_cycle IN ('none', 'monthly', 'annual', 'one_time')),
    price_idr       INTEGER NOT NULL,
    price_usd       INTEGER DEFAULT 0,
    features        JSONB,
    mayar_product_id TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    sort_order      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);


-- ─── 3.3 SUBSCRIPTIONS ─────────────────────────────────────────────────────
CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_id                 TEXT NOT NULL REFERENCES plans(id),
    status                  TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'past_due', 'cancelled', 'expired')),
    current_period_start    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end      TIMESTAMPTZ,
    cancelled_at            TIMESTAMPTZ,
    cancel_reason           TEXT,
    renewal_mode            TEXT DEFAULT 'manual_qris'
        CHECK (renewal_mode IN ('manual_qris', 'auto_card')),
    mayar_customer_id       TEXT,
    mayar_user_id           TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_subs_one_active_per_user
    ON subscriptions(user_id) WHERE status IN ('active', 'past_due');
CREATE INDEX idx_subs_user       ON subscriptions(user_id);
CREATE INDEX idx_subs_status     ON subscriptions(status);
CREATE INDEX idx_subs_period_end ON subscriptions(current_period_end);

CREATE TRIGGER subscriptions_set_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 3.4 INVOICES ───────────────────────────────────────────────────────────
CREATE TABLE invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             TEXT NOT NULL REFERENCES profiles(id),
    subscription_id     UUID REFERENCES subscriptions(id),
    plan_id             TEXT NOT NULL REFERENCES plans(id),
    invoice_number      TEXT UNIQUE,
    amount_idr          INTEGER NOT NULL,
    tax_idr             INTEGER NOT NULL DEFAULT 0,
    total_idr           INTEGER NOT NULL,
    status              TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'paid', 'expired', 'cancelled')),
    kind                TEXT NOT NULL DEFAULT 'new'
        CHECK (kind IN ('new', 'renewal', 'upgrade', 'purchase')),
    due_date            TIMESTAMPTZ,
    mayar_invoice_id    TEXT,
    mayar_transaction_id TEXT,
    checkout_url        TEXT,
    external_id         TEXT,
    idempotency_key     TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inv_user    ON invoices(user_id);
CREATE INDEX idx_inv_mayar   ON invoices(mayar_invoice_id);
CREATE INDEX idx_inv_status  ON invoices(status);
CREATE INDEX idx_inv_ext_id  ON invoices(external_id);

CREATE UNIQUE INDEX idx_inv_one_pending_renewal
    ON invoices(user_id, kind) WHERE status IN ('draft', 'sent') AND kind = 'renewal';

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE TRIGGER invoices_set_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 3.5 PAYMENTS ───────────────────────────────────────────────────────────
CREATE TABLE payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             TEXT NOT NULL REFERENCES profiles(id),
    invoice_id          UUID REFERENCES invoices(id),
    subscription_id     UUID REFERENCES subscriptions(id),
    mayar_payment_id    TEXT,
    mayar_invoice_id    TEXT,
    xendit_transaction_id TEXT,
    amount_idr          INTEGER NOT NULL,
    payment_method      TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'expired')),
    paid_at             TIMESTAMPTZ,
    raw_webhook         JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pay_user   ON payments(user_id);
CREATE INDEX idx_pay_mayar  ON payments(mayar_payment_id);
CREATE INDEX idx_pay_inv    ON payments(invoice_id);

CREATE UNIQUE INDEX idx_pay_idempotent
    ON payments(mayar_payment_id) WHERE status = 'paid';


-- ─── 3.6 ENTITLEMENTS ──────────────────────────────────────────────────────
CREATE TABLE entitlements (
    user_id             TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    tier                TEXT NOT NULL DEFAULT 'free'
        CHECK (tier IN ('free', 'pro')),
    can_export_pdf      BOOLEAN DEFAULT FALSE,
    can_save_projects   BOOLEAN DEFAULT FALSE,
    can_advanced_mode   BOOLEAN DEFAULT FALSE,
    can_compare         BOOLEAN DEFAULT FALSE,
    can_full_breakdown  BOOLEAN DEFAULT FALSE,
    can_white_label     BOOLEAN DEFAULT FALSE,
    can_api_access      BOOLEAN DEFAULT FALSE,
    max_it_load_kw      INTEGER DEFAULT 5000,
    max_projects        INTEGER DEFAULT 0,
    max_exports_per_day INTEGER DEFAULT 0,
    watermark           BOOLEAN DEFAULT TRUE,
    export_credits      INTEGER DEFAULT 0,
    calc_version_access TEXT,
    feature_flags       JSONB DEFAULT '{}'::jsonb,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER entitlements_set_updated_at
    BEFORE UPDATE ON entitlements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 3.7 PROJECTS ───────────────────────────────────────────────────────────
CREATE TABLE projects (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    calculator_type   TEXT NOT NULL CHECK (calculator_type IN ('capex', 'opex')),
    name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
    config            JSONB NOT NULL,
    config_hash       TEXT,
    calc_version      TEXT,
    results           JSONB,
    is_scenario_a     BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proj_user ON projects(user_id);

CREATE TRIGGER projects_set_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── 3.8 EXPORTS ────────────────────────────────────────────────────────────
CREATE TABLE exports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL REFERENCES profiles(id),
    project_id      UUID REFERENCES projects(id),
    calculator_type TEXT NOT NULL CHECK (calculator_type IN ('capex', 'opex')),
    export_type     TEXT NOT NULL DEFAULT 'pdf' CHECK (export_type IN ('pdf', 'png', 'csv')),
    status          TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'generating', 'ready', 'failed', 'expired')),
    storage_path    TEXT,
    config_snapshot JSONB,
    calc_version    TEXT,
    download_count  INTEGER DEFAULT 0,
    max_downloads   INTEGER DEFAULT 3,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exports_user ON exports(user_id);


-- ─── 3.9 WEBHOOK LOG ────────────────────────────────────────────────────────
CREATE TABLE webhook_log (
    id                  BIGSERIAL PRIMARY KEY,
    provider            TEXT NOT NULL DEFAULT 'mayar',
    provider_event_id   TEXT,
    event_type          TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
    raw_payload         JSONB NOT NULL,
    error_message       TEXT,
    processed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_webhook_dedup
    ON webhook_log(provider, provider_event_id) WHERE provider_event_id IS NOT NULL;
CREATE INDEX idx_webhook_created ON webhook_log(created_at);


-- ─── 3.10 USAGE EVENTS ─────────────────────────────────────────────────────
CREATE TABLE usage_events (
    id          BIGSERIAL PRIMARY KEY,
    user_id     TEXT REFERENCES profiles(id),
    event_type  TEXT NOT NULL,
    calculator  TEXT,
    metadata    JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_user    ON usage_events(user_id);
CREATE INDEX idx_usage_type    ON usage_events(event_type);
CREATE INDEX idx_usage_created ON usage_events(created_at);


-- ─── 3.11 AUDIT LOG ────────────────────────────────────────────────────────
CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    user_id     TEXT REFERENCES profiles(id),
    action      TEXT NOT NULL,
    detail      JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user    ON audit_log(user_id);
CREATE INDEX idx_audit_action  ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at);


-- ─── 3.12 REMINDER LOG ─────────────────────────────────────────────────────
CREATE TABLE reminder_log (
    id                BIGSERIAL PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES profiles(id),
    subscription_id   UUID REFERENCES subscriptions(id),
    invoice_id        UUID REFERENCES invoices(id),
    channel           TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'push')),
    reminder_type     TEXT NOT NULL,
    sent_at           TIMESTAMPTZ DEFAULT NOW(),
    delivered         BOOLEAN DEFAULT FALSE,
    metadata          JSONB
);

CREATE INDEX idx_reminder_user    ON reminder_log(user_id);
CREATE INDEX idx_reminder_sent_at ON reminder_log(sent_at);


-- ─── 3.13 FCM TOKENS (NEW in v2) ───────────────────────────────────────────
-- Firebase Cloud Messaging device tokens for push notifications.
CREATE TABLE fcm_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token       TEXT NOT NULL,
    device_info JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);

CREATE INDEX idx_fcm_user ON fcm_tokens(user_id);


-- ══════════════════════════════
-- 4. ROW LEVEL SECURITY (RLS)
-- ══════════════════════════════
-- With Firebase Auth, users don't have Supabase JWTs.
-- All user-facing queries go through Cloud Run (service_role key).
-- RLS is enabled to protect against accidental direct access.
-- Service-role policies allow Cloud Run full access.

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
ALTER TABLE fcm_tokens    ENABLE ROW LEVEL SECURITY;

-- FORCE RLS on billing-critical tables
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices      FORCE ROW LEVEL SECURITY;
ALTER TABLE payments      FORCE ROW LEVEL SECURITY;
ALTER TABLE entitlements  FORCE ROW LEVEL SECURITY;

-- Plans: public read (pricing page, no auth needed)
CREATE POLICY "plans_public_read" ON plans
    FOR SELECT USING (true);

-- Service-role policies: Cloud Run has full access via service_role key
CREATE POLICY "service_profiles_all" ON profiles
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_subs_all" ON subscriptions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_invoices_all" ON invoices
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_payments_all" ON payments
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_entitlements_all" ON entitlements
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_projects_all" ON projects
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_exports_all" ON exports
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_webhook_all" ON webhook_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_usage_all" ON usage_events
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_audit_all" ON audit_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_reminder_all" ON reminder_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_fcm_all" ON fcm_tokens
    FOR ALL TO service_role USING (true) WITH CHECK (true);


-- ══════════════════════════════
-- 5. TRIGGERS & FUNCTIONS
-- ══════════════════════════════

-- NOTE: handle_new_user() trigger is REMOVED in v2.
-- Profile creation is handled by Cloud Run on first GET /api/me call.
-- This allows Firebase Auth to be the sole auth provider.

-- ─── 5.1 Sync entitlements on subscription change ──────────────────────────
CREATE OR REPLACE FUNCTION sync_entitlements()
RETURNS TRIGGER AS $$
DECLARE
    plan_record RECORD;
BEGIN
    SELECT * INTO plan_record FROM plans WHERE id = NEW.plan_id;

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
            plan_record.tier = 'pro',
            plan_record.tier = 'pro',
            plan_record.tier = 'pro',
            plan_record.tier = 'pro',
            plan_record.tier = 'pro',
            FALSE, FALSE,
            CASE plan_record.tier WHEN 'free' THEN 5000 ELSE 100000 END,
            CASE plan_record.tier WHEN 'free' THEN 0 ELSE 5 END,
            CASE plan_record.tier WHEN 'free' THEN 0 ELSE 10 END,
            plan_record.tier = 'free',
            NULL, NOW()
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

    ELSIF NEW.status = 'past_due' THEN
        UPDATE entitlements SET
            can_export_pdf = FALSE,
            watermark      = TRUE,
            updated_at     = NOW()
        WHERE user_id = NEW.user_id;

    ELSIF NEW.status = 'cancelled'
      AND NEW.current_period_end IS NOT NULL
      AND NEW.current_period_end >= NOW() THEN
        NULL;

    ELSIF NEW.status IN ('expired', 'cancelled')
      AND (NEW.current_period_end IS NULL OR NEW.current_period_end < NOW()) THEN
        UPDATE entitlements SET
            tier = 'free', can_export_pdf = FALSE, can_save_projects = FALSE,
            can_advanced_mode = FALSE, can_compare = FALSE, can_full_breakdown = FALSE,
            can_white_label = FALSE, can_api_access = FALSE,
            max_it_load_kw = 5000, max_projects = 0, max_exports_per_day = 0,
            watermark = TRUE, calc_version_access = NULL, updated_at = NOW()
        WHERE user_id = NEW.user_id;
    END IF;

    IF plan_record.billing_cycle = 'one_time' AND NEW.status = 'active' THEN
        UPDATE entitlements SET
            export_credits = export_credits + COALESCE((plan_record.features->>'credits')::integer, 1),
            updated_at = NOW()
        WHERE user_id = NEW.user_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public, pg_temp;

CREATE TRIGGER on_subscription_change
    AFTER INSERT OR UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION sync_entitlements();


-- ─── 5.2 Process payment webhook ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION process_payment_webhook(
    p_mayar_invoice_id TEXT,
    p_external_id TEXT,
    p_status TEXT,
    p_payment_id TEXT,
    p_payment_method TEXT,
    p_amount INTEGER,
    p_raw_webhook JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_invoice RECORD;
    v_result JSONB;
BEGIN
    SELECT * INTO v_invoice FROM invoices
    WHERE mayar_invoice_id = p_mayar_invoice_id
       OR external_id = p_external_id
    LIMIT 1;

    IF v_invoice IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Invoice not found');
    END IF;

    IF p_status = 'paid' AND p_amount != v_invoice.total_idr THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Amount mismatch');
    END IF;

    IF v_invoice.status IN ('paid', 'expired', 'cancelled') THEN
        RETURN jsonb_build_object('ok', true, 'message', 'Already processed');
    END IF;

    IF p_status = 'paid' THEN
        UPDATE invoices SET status = 'paid', updated_at = NOW()
        WHERE id = v_invoice.id AND status NOT IN ('paid');

        INSERT INTO payments (user_id, invoice_id, subscription_id,
            mayar_payment_id, mayar_invoice_id, amount_idr,
            payment_method, status, paid_at, raw_webhook)
        VALUES (v_invoice.user_id, v_invoice.id, v_invoice.subscription_id,
            p_payment_id, p_mayar_invoice_id, p_amount,
            p_payment_method, 'paid', NOW(), p_raw_webhook)
        ON CONFLICT DO NOTHING;

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

        INSERT INTO audit_log (user_id, action, detail)
        VALUES (v_invoice.user_id, 'PAYMENT_SUCCESS', jsonb_build_object(
            'invoice_id', v_invoice.id, 'amount', p_amount,
            'method', p_payment_method, 'plan', v_invoice.plan_id
        ));

        v_result := jsonb_build_object('ok', true, 'action', 'activated');

    ELSIF p_status = 'expired' THEN
        UPDATE invoices SET status = 'expired', updated_at = NOW()
        WHERE id = v_invoice.id AND status NOT IN ('paid', 'expired');
        v_result := jsonb_build_object('ok', true, 'action', 'expired');

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


-- ─── 5.3 Generate invoice number ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'INV-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 6, '0');
END;
$$ LANGUAGE plpgsql;


-- ─── 5.4 Reconcile entitlements ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reconcile_entitlements()
RETURNS TABLE(user_id TEXT, action TEXT) AS $$
BEGIN
    RETURN QUERY
    UPDATE subscriptions s SET status = 'past_due', updated_at = NOW()
    WHERE s.status = 'active'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end < NOW()
      AND s.plan_id != 'free'
    RETURNING s.user_id, 'set_past_due'::TEXT;

    RETURN QUERY
    UPDATE subscriptions s SET status = 'expired', updated_at = NOW()
    WHERE s.status = 'past_due'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end + INTERVAL '3 days' < NOW()
    RETURNING s.user_id, 'expired_after_grace'::TEXT;

    RETURN QUERY
    UPDATE subscriptions s SET status = 'expired', updated_at = NOW()
    WHERE s.status = 'cancelled'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end < NOW()
    RETURNING s.user_id, 'cancelled_expired'::TEXT;

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
-- 7. MIGRATION FROM v1.1.0
-- ══════════════════════════════
-- Run this section ONLY if migrating from v1.1.0.
-- Skip if deploying fresh (use tables above directly).
--
-- WARNING: This is destructive. Back up your database first.
--
-- MIGRATION STEPS:
--   1. Drop the handle_new_user trigger and function
--   2. Alter profiles.id from UUID to TEXT
--   3. Alter all user_id columns from UUID to TEXT
--   4. Add new columns to profiles
--   5. Create fcm_tokens table
--   6. Drop old auth.uid() RLS policies
--   7. Create new service_role policies
--
-- Uncomment the block below to run migration:
/*
BEGIN;

-- Step 1: Remove Supabase Auth trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Step 2: Drop FK constraints temporarily
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_user_id_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE entitlements DROP CONSTRAINT IF EXISTS entitlements_user_id_fkey;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
ALTER TABLE exports DROP CONSTRAINT IF EXISTS exports_user_id_fkey;
ALTER TABLE usage_events DROP CONSTRAINT IF EXISTS usage_events_user_id_fkey;
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;
ALTER TABLE reminder_log DROP CONSTRAINT IF EXISTS reminder_log_user_id_fkey;

-- Step 3: Drop profiles PK and auth.users FK
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_pkey;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 4: Convert all UUID columns to TEXT
ALTER TABLE profiles ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE subscriptions ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE invoices ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE payments ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE entitlements ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE projects ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE exports ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE usage_events ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE audit_log ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;
ALTER TABLE reminder_log ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Step 5: Recreate PK and FKs
ALTER TABLE profiles ADD PRIMARY KEY (id);
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE payments ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE entitlements ADD CONSTRAINT entitlements_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE projects ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE exports ADD CONSTRAINT exports_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE usage_events ADD CONSTRAINT usage_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE audit_log ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE reminder_log ADD CONSTRAINT reminder_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);

-- Step 6: Add new profile columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS firebase_provider TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Step 7: Create fcm_tokens table
CREATE TABLE IF NOT EXISTS fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_info JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);
CREATE INDEX IF NOT EXISTS idx_fcm_user ON fcm_tokens(user_id);
ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_fcm_all" ON fcm_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Step 8: Drop old auth.uid() policies, create service_role policies
DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "service_profiles_all" ON profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Step 9: Update reconcile function return type
DROP FUNCTION IF EXISTS reconcile_entitlements();
-- Re-create with TEXT return type (see function definition above)

COMMIT;
*/
