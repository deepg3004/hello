-- =============================================================================
-- InvoxAI — 001_initial_schema.sql
-- Initial database schema: 18 tables, helpers, indexes, triggers, RLS policies.
-- Apply once in a fresh Supabase project (SQL Editor → New Query → paste → Run,
-- or via `supabase db push` if using the CLI).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- belt and braces

-- -----------------------------------------------------------------------------
-- 1. Helper functions
--    Declared early so RLS policies and triggers below can reference them.
-- -----------------------------------------------------------------------------

-- Generic BEFORE-UPDATE trigger function: keeps updated_at honest.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- SECURITY DEFINER admin check — bypasses RLS so policies on user_profiles
-- itself can call this without recursing. STABLE = cached per statement.
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = uid AND is_admin = TRUE
  );
$$;

-- Auto-create a user_profiles row whenever auth.users gets a new signup.
-- SECURITY DEFINER because the signup happens with no logged-in role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. Tables (dependency order)
-- =============================================================================

-- -- user_profiles --------------------------------------------------------------
CREATE TABLE public.user_profiles (
  id                     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name              TEXT,
  email                  TEXT UNIQUE NOT NULL,
  phone                  TEXT,
  avatar_url             TEXT,
  kyc_level              SMALLINT DEFAULT 0 CHECK (kyc_level IN (0,1,2,3)),
  payouts_enabled        BOOLEAN DEFAULT FALSE,
  subscription_plan      TEXT DEFAULT 'free'
                           CHECK (subscription_plan IN ('free','starter','pro','business')),
  subscription_status    TEXT DEFAULT 'inactive'
                           CHECK (subscription_status IN ('active','inactive','past_due','cancelled','trialing')),
  subscription_ends_at   TIMESTAMPTZ,
  razorpay_customer_id   TEXT,
  bank_account_number    TEXT,
  bank_ifsc              TEXT,
  bank_holder_name       TEXT,
  bank_verified          BOOLEAN DEFAULT FALSE,
  pan_number             TEXT,
  pan_verified           BOOLEAN DEFAULT FALSE,
  gstin                  TEXT,
  is_admin               BOOLEAN DEFAULT FALSE,
  total_revenue          DECIMAL(12,2) DEFAULT 0,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- -- pages ---------------------------------------------------------------------
CREATE TABLE public.pages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('payment','landing','lead_magnet')),
  status              TEXT DEFAULT 'draft'
                        CHECK (status IN ('draft','published','paused','archived')),
  template_id         TEXT,
  page_config         JSONB DEFAULT '{}'::jsonb,
  custom_domain       TEXT,
  meta_title          TEXT,
  meta_description    TEXT,
  meta_image_url      TEXT,
  thumbnail_url       TEXT,
  view_count          BIGINT DEFAULT 0,
  conversion_count    BIGINT DEFAULT 0,
  total_revenue       DECIMAL(12,2) DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- -- products ------------------------------------------------------------------
CREATE TABLE public.products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  page_id       UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  price         DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency      TEXT DEFAULT 'INR',
  tax_rate      DECIMAL(5,2) DEFAULT 18,
  hsn_sac_code  TEXT,
  type          TEXT DEFAULT 'one_time'
                  CHECK (type IN ('one_time','subscription','free')),
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- -- orders --------------------------------------------------------------------
CREATE TABLE public.orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id             UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  seller_user_id      UUID NOT NULL REFERENCES public.user_profiles(id),
  product_id          UUID REFERENCES public.products(id) ON DELETE SET NULL,
  buyer_email         TEXT NOT NULL,
  buyer_name          TEXT,
  buyer_phone         TEXT,
  buyer_address       JSONB,
  amount              DECIMAL(10,2) NOT NULL,
  platform_commission DECIMAL(10,2) NOT NULL DEFAULT 0,
  seller_amount       DECIMAL(10,2) NOT NULL,
  currency            TEXT DEFAULT 'INR',
  status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending','paid','failed','refunded','cancelled')),
  payment_gateway     TEXT DEFAULT 'razorpay',
  gateway_order_id    TEXT,
  gateway_payment_id  TEXT,
  gateway_signature   TEXT,
  source              TEXT DEFAULT 'direct'
                        CHECK (source IN ('direct','bump','oto','affiliate')),
  parent_order_id     UUID REFERENCES public.orders(id),
  coupon_id           UUID,                    -- soft ref; coupons created later
  discount_amount     DECIMAL(10,2) DEFAULT 0,
  utm_source          TEXT,
  utm_medium          TEXT,
  utm_campaign        TEXT,
  ip_address          INET,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- -- transactions --------------------------------------------------------------
CREATE TABLE public.transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.user_profiles(id),
  order_id      UUID REFERENCES public.orders(id),
  type          TEXT NOT NULL
                  CHECK (type IN ('sale','commission','payout','refund','subscription_payment')),
  amount        DECIMAL(10,2) NOT NULL,
  status        TEXT DEFAULT 'completed',
  reference_id  TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- -- payouts ------------------------------------------------------------------
CREATE TABLE public.payouts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES public.user_profiles(id),
  amount             DECIMAL(10,2) NOT NULL,
  status             TEXT DEFAULT 'pending'
                       CHECK (status IN ('pending','processing','completed','failed')),
  gateway            TEXT DEFAULT 'razorpay',
  gateway_payout_id  TEXT,
  bank_account       TEXT,
  bank_ifsc          TEXT,
  failure_reason     TEXT,
  initiated_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at       TIMESTAMPTZ
);

-- -- user_subscriptions --------------------------------------------------------
CREATE TABLE public.user_subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES public.user_profiles(id),
  plan                      TEXT NOT NULL,
  status                    TEXT DEFAULT 'active',
  razorpay_subscription_id  TEXT,
  razorpay_plan_id          TEXT,
  amount                    DECIMAL(10,2),
  starts_at                 TIMESTAMPTZ DEFAULT NOW(),
  ends_at                   TIMESTAMPTZ,
  cancelled_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- -- telegram_vip_groups ------------------------------------------------------
CREATE TABLE public.telegram_vip_groups (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES public.user_profiles(id),
  page_id                UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  bot_token              TEXT NOT NULL,
  group_id               TEXT NOT NULL,
  group_name             TEXT,
  invite_link            TEXT,
  access_duration_days   INT DEFAULT 30,
  auto_remove            BOOLEAN DEFAULT TRUE,
  active_members         INT DEFAULT 0,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- -- telegram_memberships -----------------------------------------------------
CREATE TABLE public.telegram_memberships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id          UUID REFERENCES public.telegram_vip_groups(id),
  order_id          UUID REFERENCES public.orders(id),
  telegram_user_id  TEXT,
  buyer_email       TEXT,
  joined_at         TIMESTAMPTZ DEFAULT NOW(),
  expires_at        TIMESTAMPTZ,
  removed_at        TIMESTAMPTZ,
  status            TEXT DEFAULT 'active'
                      CHECK (status IN ('active','expired','removed'))
);

-- -- lead_captures ------------------------------------------------------------
CREATE TABLE public.lead_captures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id         UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  seller_user_id  UUID NOT NULL REFERENCES public.user_profiles(id),
  name            TEXT,
  email           TEXT NOT NULL,
  phone           TEXT,
  custom_fields   JSONB DEFAULT '{}'::jsonb,
  utm_source      TEXT,
  ip_address      INET,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -- coupons -----------------------------------------------------------------
CREATE TABLE public.coupons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.user_profiles(id),
  code                TEXT NOT NULL,
  discount_type       TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value      DECIMAL(10,2) NOT NULL,
  min_order           DECIMAL(10,2) DEFAULT 0,
  max_discount        DECIMAL(10,2),
  total_limit         INT,
  per_customer_limit  INT DEFAULT 1,
  usage_count         INT DEFAULT 0,
  starts_at           TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  page_ids            UUID[],
  active              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, code)
);

-- -- upsells -----------------------------------------------------------------
CREATE TABLE public.upsells (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.user_profiles(id),
  trigger_page_id     UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  offer_product_id    UUID REFERENCES public.products(id),
  price               DECIMAL(10,2) NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('bump','oto')),
  title               TEXT NOT NULL,
  description         TEXT,
  image_url           TEXT,
  active              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- -- abandoned_checkouts -----------------------------------------------------
CREATE TABLE public.abandoned_checkouts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id            UUID REFERENCES public.pages(id) ON DELETE SET NULL,
  seller_user_id     UUID REFERENCES public.user_profiles(id),
  buyer_email        TEXT NOT NULL,
  buyer_phone        TEXT,
  buyer_name         TEXT,
  amount             DECIMAL(10,2),
  status             TEXT DEFAULT 'active'
                       CHECK (status IN ('active','recovered','expired')),
  recovery_step      INT DEFAULT 0,
  recovery_token     TEXT UNIQUE,
  token_expires_at   TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  recovered_at       TIMESTAMPTZ
);

-- -- kyc_submissions ---------------------------------------------------------
CREATE TABLE public.kyc_submissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id),
  level              SMALLINT,
  status             TEXT DEFAULT 'pending'
                       CHECK (status IN ('pending','approved','rejected','under_review')),
  pan_number         TEXT,
  pan_name           TEXT,
  pan_verified_at    TIMESTAMPTZ,
  bank_verified_at   TIMESTAMPTZ,
  selfie_url         TEXT,
  id_document_url    TEXT,
  rejection_reason   TEXT,
  reviewer_id        UUID REFERENCES public.user_profiles(id),
  reviewed_at        TIMESTAMPTZ,
  risk_flags         JSONB DEFAULT '[]'::jsonb,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- -- invoices ----------------------------------------------------------------
CREATE TABLE public.invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID UNIQUE REFERENCES public.orders(id),
  seller_user_id  UUID REFERENCES public.user_profiles(id),
  invoice_number  TEXT UNIQUE NOT NULL,
  buyer_name      TEXT,
  buyer_email     TEXT,
  buyer_gstin     TEXT,
  seller_gstin    TEXT,
  taxable_amount  DECIMAL(10,2),
  tax_rate        DECIMAL(5,2),
  cgst            DECIMAL(10,2),
  sgst            DECIMAL(10,2),
  igst            DECIMAL(10,2),
  total_amount    DECIMAL(10,2),
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- -- pixel_configs -----------------------------------------------------------
CREATE TABLE public.pixel_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id             UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  meta_pixel_id       TEXT,
  meta_access_token   TEXT,
  google_ads_id       TEXT,
  google_ads_label    TEXT,
  tiktok_pixel_id     TEXT,
  hotjar_id           TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- -- social_proof_events -----------------------------------------------------
CREATE TABLE public.social_proof_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id       UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
  buyer_name    TEXT,
  buyer_city    TEXT,
  product_name  TEXT,
  amount        DECIMAL(10,2),
  is_seed       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- -- admin_audit_logs --------------------------------------------------------
CREATE TABLE public.admin_audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID REFERENCES public.user_profiles(id),
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    UUID,
  details      JSONB,
  ip_address   INET,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. Indexes
-- =============================================================================

CREATE INDEX idx_pages_slug                        ON public.pages (slug);
CREATE INDEX idx_pages_user_id                     ON public.pages (user_id);
CREATE INDEX idx_pages_status                      ON public.pages (status);

CREATE INDEX idx_orders_seller_user_id             ON public.orders (seller_user_id);
CREATE INDEX idx_orders_buyer_email                ON public.orders (buyer_email);
CREATE INDEX idx_orders_status                     ON public.orders (status);
CREATE INDEX idx_orders_created_at                 ON public.orders (created_at);
CREATE INDEX idx_orders_gateway_order_id           ON public.orders (gateway_order_id);

CREATE INDEX idx_transactions_user_id              ON public.transactions (user_id);
CREATE INDEX idx_transactions_created_at           ON public.transactions (created_at);

CREATE INDEX idx_abandoned_checkouts_buyer_email   ON public.abandoned_checkouts (buyer_email);
CREATE INDEX idx_abandoned_checkouts_recovery_tok  ON public.abandoned_checkouts (recovery_token);

CREATE INDEX idx_kyc_submissions_user_id           ON public.kyc_submissions (user_id);

CREATE INDEX idx_lead_captures_page_id             ON public.lead_captures (page_id);
CREATE INDEX idx_lead_captures_seller_user_id      ON public.lead_captures (seller_user_id);

CREATE INDEX idx_social_proof_events_page_id       ON public.social_proof_events (page_id);
CREATE INDEX idx_social_proof_events_created_at    ON public.social_proof_events (created_at);

-- =============================================================================
-- 4. Triggers
-- =============================================================================

-- updated_at maintenance
CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER pages_set_updated_at
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auth signup → user_profiles row
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 5. Row Level Security
--    Strategy:
--      • Enable RLS on every public table.
--      • Define explicit policies per requirement; no policy = no access for
--        the authenticated role (service_role always bypasses RLS).
-- =============================================================================

ALTER TABLE public.user_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_vip_groups   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_memberships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_captures         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upsells               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abandoned_checkouts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_submissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pixel_configs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_proof_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs      ENABLE ROW LEVEL SECURITY;

-- -- user_profiles -----------------------------------------------------------
CREATE POLICY "user_profiles: read own or admin reads any"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "user_profiles: update own"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "user_profiles: insert own"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- -- pages -----------------------------------------------------------------
CREATE POLICY "pages: public read published"
  ON public.pages
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE POLICY "pages: owner full read"
  ON public.pages
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "pages: owner insert"
  ON public.pages
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pages: owner update"
  ON public.pages
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pages: owner delete"
  ON public.pages
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- -- products ----------------------------------------------------------------
CREATE POLICY "products: owner all"
  ON public.products
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -- orders ------------------------------------------------------------------
-- Sellers read only their own. INSERT/UPDATE/DELETE are intentionally
-- service_role-only (no policy → blocked for authenticated).
CREATE POLICY "orders: seller read own"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (seller_user_id = auth.uid() OR public.is_admin(auth.uid()));

-- -- transactions ------------------------------------------------------------
CREATE POLICY "transactions: owner read"
  ON public.transactions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- -- payouts -----------------------------------------------------------------
CREATE POLICY "payouts: owner read"
  ON public.payouts
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- -- user_subscriptions ------------------------------------------------------
CREATE POLICY "user_subscriptions: owner read"
  ON public.user_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- -- telegram_vip_groups -----------------------------------------------------
CREATE POLICY "telegram_vip_groups: owner all"
  ON public.telegram_vip_groups
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -- telegram_memberships ----------------------------------------------------
-- Owner = the seller who owns the telegram_vip_group this membership belongs
-- to. Reached via a join.
CREATE POLICY "telegram_memberships: group owner read"
  ON public.telegram_memberships
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.telegram_vip_groups g
      WHERE g.id = telegram_memberships.group_id
        AND g.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- -- lead_captures -----------------------------------------------------------
CREATE POLICY "lead_captures: seller read"
  ON public.lead_captures
  FOR SELECT
  TO authenticated
  USING (seller_user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Public form submissions (the lead-capture form on a published page).
-- Anyone can INSERT a lead row — server enforces page validity.
CREATE POLICY "lead_captures: public insert"
  ON public.lead_captures
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- -- coupons ----------------------------------------------------------------
CREATE POLICY "coupons: owner all"
  ON public.coupons
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -- upsells ---------------------------------------------------------------
CREATE POLICY "upsells: owner all"
  ON public.upsells
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -- abandoned_checkouts ---------------------------------------------------
CREATE POLICY "abandoned_checkouts: seller read"
  ON public.abandoned_checkouts
  FOR SELECT
  TO authenticated
  USING (seller_user_id = auth.uid() OR public.is_admin(auth.uid()));

-- -- kyc_submissions -------------------------------------------------------
CREATE POLICY "kyc_submissions: owner read"
  ON public.kyc_submissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "kyc_submissions: owner write"
  ON public.kyc_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "kyc_submissions: owner update"
  ON public.kyc_submissions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- -- invoices --------------------------------------------------------------
CREATE POLICY "invoices: seller read"
  ON public.invoices
  FOR SELECT
  TO authenticated
  USING (seller_user_id = auth.uid() OR public.is_admin(auth.uid()));

-- -- pixel_configs --------------------------------------------------------
-- Owner = the user who owns the page this pixel config belongs to.
CREATE POLICY "pixel_configs: page owner all"
  ON public.pixel_configs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = pixel_configs.page_id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = pixel_configs.page_id AND p.user_id = auth.uid()
    )
  );

-- -- social_proof_events --------------------------------------------------
CREATE POLICY "social_proof_events: public read"
  ON public.social_proof_events
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "social_proof_events: page owner write"
  ON public.social_proof_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pages p
      WHERE p.id = social_proof_events.page_id AND p.user_id = auth.uid()
    )
  );

-- -- admin_audit_logs -----------------------------------------------------
-- Writes are service_role only (no INSERT policy). Admins can SELECT.
CREATE POLICY "admin_audit_logs: admin read"
  ON public.admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- =============================================================================
-- 6. Grants
--    Supabase's authenticated/anon roles need usage on the schema and
--    table-level grants so RLS policies actually have something to filter.
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT                ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT                 ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Apply the same grants to anything created after this migration runs.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT                ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT                 ON SEQUENCES TO authenticated;

-- =============================================================================
-- Done.
-- =============================================================================
