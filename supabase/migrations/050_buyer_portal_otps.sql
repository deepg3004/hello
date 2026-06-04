-- =============================================================================
-- 050 — buyer portal passwordless login
--
-- buyer_portal_otps — short-lived OTP for the public /account buyer portal,
--   where a buyer logs in with their email and sees everything they bought
--   (courses, Telegram access, invoices, receipts) across all sellers.
--
-- Mirrors affiliate_portal_otps (migration 016). Service-role only; RLS on with
-- no policies so the table is never readable from the browser.
-- =============================================================================

begin;

create table if not exists public.buyer_portal_otps (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  otp_hash     text not null,
  expires_at   timestamptz not null,
  attempts     integer not null default 0,
  used_at      timestamptz,
  ip_address   inet,
  created_at   timestamptz default now()
);

create index if not exists buyer_portal_otps_email_idx
  on public.buyer_portal_otps(email);
create index if not exists buyer_portal_otps_created_idx
  on public.buyer_portal_otps(created_at);

alter table public.buyer_portal_otps enable row level security;

commit;
