-- =============================================================================
-- 048 — Seller branding
-- Profile/branding fields that feed the seller's website (subdomain) — bio,
-- tagline, social links, brand colour, and a free-form site_config (nav/theme).
-- =============================================================================
begin;

alter table public.user_profiles
  add column if not exists bio          text,
  add column if not exists tagline      text,
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists brand_color  text,
  add column if not exists site_config  jsonb not null default '{}'::jsonb;

commit;
