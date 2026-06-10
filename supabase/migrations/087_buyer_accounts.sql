-- =============================================================================
-- 087 — buyer accounts + login audit
--
-- The /account buyer portal authenticates by VERIFIED EMAIL (signed cookie) and
-- aggregates everything bought with that email across all sellers. Until now a
-- "buyer" was just an email string on orders. This adds:
--
--   buyers              — one portal account per email, with profile (name,
--                         avatar, google_id) and the login provider used.
--   buyer_login_events  — append-only audit of every portal login (Google or
--                         email-OTP), with host / ip / user-agent.
--
-- These DON'T change how the portal reads data (still keyed by email) — they
-- enrich it (Google profile, last-login) and give admins a login audit. Both
-- are written by the service role only (RLS on, no policies → never readable
-- from the browser), mirroring buyer_portal_otps (050).
-- =============================================================================

begin;

create table if not exists public.buyers (
  id                uuid primary key default gen_random_uuid(),
  email             text unique not null,
  name              text,
  avatar_url        text,
  google_id         text,
  -- The provider the buyer most recently signed in with.
  primary_provider  text not null default 'email_otp'
                      check (primary_provider in ('google', 'email_otp')),
  email_verified    boolean not null default false,
  first_login_at    timestamptz not null default now(),
  last_login_at     timestamptz not null default now(),
  login_count       integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- A Google sub is globally unique to one buyer.
create unique index if not exists buyers_google_id_uidx
  on public.buyers(google_id) where google_id is not null;
create index if not exists buyers_last_login_idx
  on public.buyers(last_login_at desc);

create table if not exists public.buyer_login_events (
  id           uuid primary key default gen_random_uuid(),
  buyer_id     uuid references public.buyers(id) on delete set null,
  email        text not null,
  provider     text not null check (provider in ('google', 'email_otp')),
  host         text,
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists buyer_login_events_email_idx
  on public.buyer_login_events(email, created_at desc);
create index if not exists buyer_login_events_created_idx
  on public.buyer_login_events(created_at desc);

alter table public.buyers             enable row level security;
alter table public.buyer_login_events enable row level security;

commit;
