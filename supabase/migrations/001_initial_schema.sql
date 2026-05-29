-- =============================================================================
-- InvoxAI — initial schema
-- File: supabase/migrations/001_initial_schema.sql
--
-- 18 tables, row level security, indexes, auth->profile trigger, updated_at
-- triggers. Run in Supabase SQL editor or via `supabase db push`.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared trigger function: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ===========================================================================
-- 1. user_profiles
-- ===========================================================================
create table public.user_profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  full_name              text,
  email                  text unique not null,
  phone                  text,
  avatar_url             text,
  kyc_level              smallint default 0 check (kyc_level in (0, 1, 2, 3)),
  payouts_enabled        boolean default false,
  subscription_plan      text default 'free'
    check (subscription_plan in ('free', 'starter', 'pro', 'business')),
  subscription_status    text default 'inactive'
    check (subscription_status in ('active', 'inactive', 'past_due', 'cancelled', 'trialing')),
  subscription_ends_at   timestamptz,
  razorpay_customer_id   text,
  bank_account_number    text,
  bank_ifsc              text,
  bank_holder_name       text,
  bank_verified          boolean default false,
  pan_number             text,
  pan_verified           boolean default false,
  gstin                  text,
  is_admin               boolean default false,
  total_revenue          decimal(12, 2) default 0,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- is_admin() — SECURITY DEFINER so RLS policies can call it safely
-- ---------------------------------------------------------------------------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.user_profiles where id = uid),
    false
  );
$$;

-- ===========================================================================
-- 2. pages
-- ===========================================================================
create table public.pages (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.user_profiles(id) on delete cascade,
  title               text not null,
  slug                text unique not null,
  type                text not null check (type in ('payment', 'landing', 'lead_magnet')),
  status              text default 'draft'
    check (status in ('draft', 'published', 'paused', 'archived')),
  template_id         text,
  page_config         jsonb default '{}'::jsonb,
  custom_domain       text,
  meta_title          text,
  meta_description    text,
  meta_image_url      text,
  thumbnail_url       text,
  view_count          bigint default 0,
  conversion_count    bigint default 0,
  total_revenue       decimal(12, 2) default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index pages_slug_idx    on public.pages(slug);
create index pages_user_id_idx on public.pages(user_id);
create index pages_status_idx  on public.pages(status);

create trigger pages_set_updated_at
  before update on public.pages
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 3. products
-- ===========================================================================
create table public.products (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.user_profiles(id) on delete cascade,
  page_id      uuid references public.pages(id) on delete set null,
  name         text not null,
  description  text,
  price        decimal(10, 2) not null default 0,
  currency     text default 'INR',
  tax_rate     decimal(5, 2) default 18,
  hsn_sac_code text,
  type         text default 'one_time'
    check (type in ('one_time', 'subscription', 'free')),
  active       boolean default true,
  created_at   timestamptz default now()
);

-- ===========================================================================
-- 4. orders   (self-FK; coupon_id FK attached after coupons exists)
-- ===========================================================================
create table public.orders (
  id                   uuid primary key default gen_random_uuid(),
  page_id              uuid references public.pages(id) on delete set null,
  seller_user_id       uuid not null references public.user_profiles(id),
  product_id           uuid references public.products(id) on delete set null,
  buyer_email          text not null,
  buyer_name           text,
  buyer_phone          text,
  buyer_address        jsonb,
  amount               decimal(10, 2) not null,
  platform_commission  decimal(10, 2) not null default 0,
  seller_amount        decimal(10, 2) not null,
  currency             text default 'INR',
  status               text default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  payment_gateway      text default 'razorpay',
  gateway_order_id     text,
  gateway_payment_id   text,
  gateway_signature    text,
  source               text default 'direct'
    check (source in ('direct', 'bump', 'oto', 'affiliate')),
  parent_order_id      uuid references public.orders(id),
  coupon_id            uuid,
  discount_amount      decimal(10, 2) default 0,
  utm_source           text,
  utm_medium           text,
  utm_campaign         text,
  ip_address           inet,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

create index orders_seller_user_id_idx   on public.orders(seller_user_id);
create index orders_buyer_email_idx      on public.orders(buyer_email);
create index orders_status_idx           on public.orders(status);
create index orders_created_at_idx       on public.orders(created_at);
create index orders_gateway_order_id_idx on public.orders(gateway_order_id);

-- ===========================================================================
-- 5. transactions
-- ===========================================================================
create table public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.user_profiles(id),
  order_id     uuid references public.orders(id),
  type         text not null
    check (type in ('sale', 'commission', 'payout', 'refund', 'subscription_payment')),
  amount       decimal(10, 2) not null,
  status       text default 'completed',
  reference_id text,
  notes        text,
  created_at   timestamptz default now()
);

create index transactions_user_id_idx    on public.transactions(user_id);
create index transactions_created_at_idx on public.transactions(created_at);

-- ===========================================================================
-- 6. payouts
-- ===========================================================================
create table public.payouts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.user_profiles(id),
  amount            decimal(10, 2) not null,
  status            text default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  gateway           text default 'razorpay',
  gateway_payout_id text,
  bank_account      text,
  bank_ifsc         text,
  failure_reason    text,
  initiated_at      timestamptz default now(),
  completed_at      timestamptz
);

-- ===========================================================================
-- 7. user_subscriptions
-- ===========================================================================
create table public.user_subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.user_profiles(id),
  plan                     text not null,
  status                   text default 'active',
  razorpay_subscription_id text,
  razorpay_plan_id         text,
  amount                   decimal(10, 2),
  starts_at                timestamptz default now(),
  ends_at                  timestamptz,
  cancelled_at             timestamptz,
  created_at               timestamptz default now()
);

-- ===========================================================================
-- 8. telegram_vip_groups
-- ===========================================================================
create table public.telegram_vip_groups (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.user_profiles(id),
  page_id              uuid references public.pages(id) on delete cascade,
  bot_token            text not null,
  group_id             text not null,
  group_name           text,
  invite_link          text,
  access_duration_days int default 30,
  auto_remove          boolean default true,
  active_members       int default 0,
  created_at           timestamptz default now()
);

-- ===========================================================================
-- 9. telegram_memberships
-- ===========================================================================
create table public.telegram_memberships (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid references public.telegram_vip_groups(id),
  order_id         uuid references public.orders(id),
  telegram_user_id text,
  buyer_email      text,
  joined_at        timestamptz default now(),
  expires_at       timestamptz,
  removed_at       timestamptz,
  status           text default 'active'
    check (status in ('active', 'expired', 'removed'))
);

-- ===========================================================================
-- 10. lead_captures
-- ===========================================================================
create table public.lead_captures (
  id              uuid primary key default gen_random_uuid(),
  page_id         uuid not null references public.pages(id) on delete cascade,
  seller_user_id  uuid not null references public.user_profiles(id),
  name            text,
  email           text not null,
  phone           text,
  custom_fields   jsonb default '{}'::jsonb,
  utm_source      text,
  ip_address      inet,
  created_at      timestamptz default now()
);

create index lead_captures_page_id_idx        on public.lead_captures(page_id);
create index lead_captures_seller_user_id_idx on public.lead_captures(seller_user_id);

-- ===========================================================================
-- 11. coupons
-- ===========================================================================
create table public.coupons (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.user_profiles(id),
  code                text not null,
  discount_type       text not null check (discount_type in ('percentage', 'fixed')),
  discount_value      decimal(10, 2) not null,
  min_order           decimal(10, 2) default 0,
  max_discount        decimal(10, 2),
  total_limit         int,
  per_customer_limit  int default 1,
  usage_count         int default 0,
  starts_at           timestamptz default now(),
  expires_at          timestamptz,
  page_ids            uuid[],
  active              boolean default true,
  created_at          timestamptz default now(),
  unique (user_id, code)
);

-- Now attach the orders.coupon_id FK
alter table public.orders
  add constraint orders_coupon_id_fkey
  foreign key (coupon_id) references public.coupons(id) on delete set null;

-- ===========================================================================
-- 12. upsells
-- ===========================================================================
create table public.upsells (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.user_profiles(id),
  trigger_page_id   uuid references public.pages(id) on delete cascade,
  offer_product_id  uuid references public.products(id),
  price             decimal(10, 2) not null,
  type              text not null check (type in ('bump', 'oto')),
  title             text not null,
  description       text,
  image_url         text,
  active            boolean default true,
  created_at        timestamptz default now()
);

-- ===========================================================================
-- 13. abandoned_checkouts
-- ===========================================================================
create table public.abandoned_checkouts (
  id                uuid primary key default gen_random_uuid(),
  page_id           uuid references public.pages(id) on delete set null,
  seller_user_id    uuid references public.user_profiles(id),
  buyer_email       text not null,
  buyer_phone       text,
  buyer_name        text,
  amount            decimal(10, 2),
  status            text default 'active'
    check (status in ('active', 'recovered', 'expired')),
  recovery_step     int default 0,
  recovery_token    text unique,
  token_expires_at  timestamptz,
  created_at        timestamptz default now(),
  recovered_at      timestamptz
);

create index abandoned_checkouts_buyer_email_idx    on public.abandoned_checkouts(buyer_email);
create index abandoned_checkouts_recovery_token_idx on public.abandoned_checkouts(recovery_token);

-- ===========================================================================
-- 14. kyc_submissions
-- ===========================================================================
create table public.kyc_submissions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references public.user_profiles(id),
  level              smallint,
  status             text default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'under_review')),
  pan_number         text,
  pan_name           text,
  pan_verified_at    timestamptz,
  bank_verified_at   timestamptz,
  selfie_url         text,
  id_document_url    text,
  rejection_reason   text,
  reviewer_id        uuid references public.user_profiles(id),
  reviewed_at        timestamptz,
  risk_flags         jsonb default '[]'::jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index kyc_submissions_user_id_idx on public.kyc_submissions(user_id);

-- ===========================================================================
-- 15. invoices
-- ===========================================================================
create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid unique references public.orders(id),
  seller_user_id   uuid references public.user_profiles(id),
  invoice_number   text unique not null,
  buyer_name       text,
  buyer_email      text,
  buyer_gstin      text,
  seller_gstin     text,
  taxable_amount   decimal(10, 2),
  tax_rate         decimal(5, 2),
  cgst             decimal(10, 2),
  sgst             decimal(10, 2),
  igst             decimal(10, 2),
  total_amount     decimal(10, 2),
  pdf_url          text,
  created_at       timestamptz default now()
);

-- ===========================================================================
-- 16. pixel_configs
-- ===========================================================================
create table public.pixel_configs (
  id                 uuid primary key default gen_random_uuid(),
  page_id            uuid not null references public.pages(id) on delete cascade,
  meta_pixel_id      text,
  meta_access_token  text,
  google_ads_id      text,
  google_ads_label   text,
  tiktok_pixel_id    text,
  hotjar_id          text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- ===========================================================================
-- 17. social_proof_events
-- ===========================================================================
create table public.social_proof_events (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references public.pages(id) on delete cascade,
  buyer_name    text,
  buyer_city    text,
  product_name  text,
  amount        decimal(10, 2),
  is_seed       boolean default false,
  created_at    timestamptz default now()
);

create index social_proof_events_page_id_idx    on public.social_proof_events(page_id);
create index social_proof_events_created_at_idx on public.social_proof_events(created_at);

-- ===========================================================================
-- 18. admin_audit_logs
-- ===========================================================================
create table public.admin_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.user_profiles(id),
  action      text not null,
  target_type text,
  target_id   uuid,
  details     jsonb,
  ip_address  inet,
  created_at  timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- handle_new_user(): auto-create user_profiles row on auth signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.user_profiles        enable row level security;
alter table public.pages                enable row level security;
alter table public.products             enable row level security;
alter table public.orders               enable row level security;
alter table public.transactions         enable row level security;
alter table public.payouts              enable row level security;
alter table public.user_subscriptions   enable row level security;
alter table public.telegram_vip_groups  enable row level security;
alter table public.telegram_memberships enable row level security;
alter table public.lead_captures        enable row level security;
alter table public.coupons              enable row level security;
alter table public.upsells              enable row level security;
alter table public.abandoned_checkouts  enable row level security;
alter table public.kyc_submissions      enable row level security;
alter table public.invoices             enable row level security;
alter table public.pixel_configs        enable row level security;
alter table public.social_proof_events  enable row level security;
alter table public.admin_audit_logs     enable row level security;

-- ---- user_profiles --------------------------------------------------------
create policy "user_profiles_select_self_or_admin"
  on public.user_profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "user_profiles_update_self"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---- pages ----------------------------------------------------------------
create policy "pages_owner_all"
  on public.pages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Anyone can read a published page (used to render the public /p/[slug] route)
create policy "pages_public_published_select"
  on public.pages for select
  using (status = 'published');

-- ---- products -------------------------------------------------------------
create policy "products_owner_all"
  on public.products for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- orders ---------------------------------------------------------------
-- Sellers can READ their own orders; writes happen via service role only.
create policy "orders_seller_select"
  on public.orders for select
  using (auth.uid() = seller_user_id);

-- ---- transactions ---------------------------------------------------------
create policy "transactions_owner_select"
  on public.transactions for select
  using (auth.uid() = user_id);

-- ---- payouts --------------------------------------------------------------
create policy "payouts_owner_select"
  on public.payouts for select
  using (auth.uid() = user_id);

-- ---- user_subscriptions ---------------------------------------------------
create policy "user_subscriptions_owner_select"
  on public.user_subscriptions for select
  using (auth.uid() = user_id);

-- ---- telegram_vip_groups --------------------------------------------------
create policy "telegram_vip_groups_owner_all"
  on public.telegram_vip_groups for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- telegram_memberships -------------------------------------------------
create policy "telegram_memberships_owner_select"
  on public.telegram_memberships for select
  using (
    group_id in (select id from public.telegram_vip_groups where user_id = auth.uid())
  );

-- ---- lead_captures --------------------------------------------------------
create policy "lead_captures_owner_select"
  on public.lead_captures for select
  using (auth.uid() = seller_user_id);

-- ---- coupons --------------------------------------------------------------
create policy "coupons_owner_all"
  on public.coupons for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- upsells --------------------------------------------------------------
create policy "upsells_owner_all"
  on public.upsells for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- abandoned_checkouts --------------------------------------------------
create policy "abandoned_checkouts_owner_select"
  on public.abandoned_checkouts for select
  using (auth.uid() = seller_user_id);

-- ---- kyc_submissions ------------------------------------------------------
create policy "kyc_submissions_owner_or_admin_select"
  on public.kyc_submissions for select
  using (auth.uid() = user_id or public.is_admin());

create policy "kyc_submissions_owner_insert"
  on public.kyc_submissions for insert
  with check (auth.uid() = user_id);

create policy "kyc_submissions_owner_update"
  on public.kyc_submissions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---- invoices -------------------------------------------------------------
create policy "invoices_owner_select"
  on public.invoices for select
  using (auth.uid() = seller_user_id);

-- ---- pixel_configs --------------------------------------------------------
create policy "pixel_configs_owner_all"
  on public.pixel_configs for all
  using (page_id in (select id from public.pages where user_id = auth.uid()))
  with check (page_id in (select id from public.pages where user_id = auth.uid()));

-- ---- social_proof_events --------------------------------------------------
create policy "social_proof_events_owner_select"
  on public.social_proof_events for select
  using (page_id in (select id from public.pages where user_id = auth.uid()));

-- Public read so the live widget can render on a published page
create policy "social_proof_events_public_select"
  on public.social_proof_events for select
  using (page_id in (select id from public.pages where status = 'published'));

-- ---- admin_audit_logs -----------------------------------------------------
-- Inserts/updates/deletes happen via service role only — NO write policy.
create policy "admin_audit_logs_admin_select"
  on public.admin_audit_logs for select
  using (public.is_admin());

commit;
