-- =============================================================================
-- 016 — affiliate / referral system
--
-- affiliates           — one row per (seller, page) — the program config
-- affiliate_links      — one row per affiliate — name/email + referral code
-- affiliate_payouts    — one row per attributed paid order
-- affiliate_portal_otps — short-lived OTP for the public /affiliate/portal
--                         passwordless login flow
-- =============================================================================

begin;

-- ── affiliates: per-page program config ───────────────────────────────────
create table if not exists public.affiliates (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.user_profiles(id) on delete cascade,
  page_id           uuid not null references public.pages(id) on delete cascade,
  commission_type   text not null check (commission_type in ('percentage', 'fixed')),
  commission_value  decimal(10, 2) not null check (commission_value >= 0),
  status            text not null default 'active' check (status in ('active', 'paused')),
  terms             text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (user_id, page_id)
);

create index if not exists affiliates_user_id_idx on public.affiliates(user_id);
create index if not exists affiliates_page_id_idx on public.affiliates(page_id);

create or replace function public.affiliates_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists affiliates_set_updated_at on public.affiliates;
create trigger affiliates_set_updated_at
  before update on public.affiliates
  for each row execute function public.affiliates_set_updated_at();

-- ── affiliate_links: one per affiliate ────────────────────────────────────
create table if not exists public.affiliate_links (
  id                  uuid primary key default gen_random_uuid(),
  affiliate_id        uuid not null references public.affiliates(id) on delete cascade,
  referrer_name       text not null,
  referrer_email      text not null,
  referrer_phone      text,
  referrer_pitch      text,
  -- Unique nanoid code that appears in /p/<slug>?ref=<code>
  referral_code       text not null unique,
  -- Aggregated counters (updated in /p/[slug] page render + verify-payment)
  clicks              integer not null default 0,
  conversions         integer not null default 0,
  earnings            decimal(12, 2) not null default 0,
  paid_amount         decimal(12, 2) not null default 0,
  -- Bank info the affiliate fills in via the portal
  bank_account_number text,
  bank_ifsc           text,
  bank_holder_name    text,
  bank_verified_at    timestamptz,
  status              text not null default 'active' check (status in ('active', 'paused')),
  created_at          timestamptz default now(),
  last_active_at      timestamptz,
  unique (affiliate_id, referrer_email)
);

create index if not exists affiliate_links_affiliate_idx on public.affiliate_links(affiliate_id);
create index if not exists affiliate_links_email_idx     on public.affiliate_links(referrer_email);
create index if not exists affiliate_links_code_idx      on public.affiliate_links(referral_code);

-- ── affiliate_payouts: one per attributed paid order ──────────────────────
create table if not exists public.affiliate_payouts (
  id                 uuid primary key default gen_random_uuid(),
  affiliate_link_id  uuid not null references public.affiliate_links(id) on delete cascade,
  affiliate_id       uuid not null references public.affiliates(id) on delete cascade,
  seller_user_id     uuid not null references public.user_profiles(id) on delete cascade,
  order_id           uuid not null references public.orders(id) on delete cascade,
  commission_amount  decimal(10, 2) not null check (commission_amount >= 0),
  status             text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  paid_at            timestamptz,
  /** Free-form payment reference set when the seller marks paid (UTR, etc). */
  payment_reference  text,
  created_at         timestamptz default now(),
  unique (order_id)
);

create index if not exists affiliate_payouts_link_idx    on public.affiliate_payouts(affiliate_link_id);
create index if not exists affiliate_payouts_seller_idx  on public.affiliate_payouts(seller_user_id);
create index if not exists affiliate_payouts_status_idx  on public.affiliate_payouts(status);

-- ── affiliate_portal_otps: passwordless login ─────────────────────────────
create table if not exists public.affiliate_portal_otps (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  otp_hash     text not null,
  expires_at   timestamptz not null,
  attempts     integer not null default 0,
  used_at      timestamptz,
  ip_address   inet,
  created_at   timestamptz default now()
);

create index if not exists affiliate_portal_otps_email_idx on public.affiliate_portal_otps(email);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Sellers read their own affiliate program rows + links + payouts.
-- Affiliates only ever talk through service-role endpoints, so no client
-- read policy for them.
alter table public.affiliates         enable row level security;
alter table public.affiliate_links    enable row level security;
alter table public.affiliate_payouts  enable row level security;
alter table public.affiliate_portal_otps enable row level security;

drop policy if exists "Sellers read own affiliates"        on public.affiliates;
create policy "Sellers read own affiliates"
  on public.affiliates for select using (user_id = auth.uid());

drop policy if exists "Sellers read own affiliate_links"  on public.affiliate_links;
create policy "Sellers read own affiliate_links"
  on public.affiliate_links for select using (
    affiliate_id in (select id from public.affiliates where user_id = auth.uid())
  );

drop policy if exists "Sellers read own affiliate_payouts" on public.affiliate_payouts;
create policy "Sellers read own affiliate_payouts"
  on public.affiliate_payouts for select using (seller_user_id = auth.uid());

commit;
