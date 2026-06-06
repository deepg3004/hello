-- =============================================================================
-- 072 — subdomain → custom-domain redirect toggle
--
-- Per-seller switch. When ON (and the seller has a VERIFIED custom domain),
-- requests to their *.invoxai.io subdomain are 308-redirected to the custom
-- domain, so the custom domain becomes the single canonical home for their
-- store (e.g. ddmk.invoxai.io/x → https://invoxai.shop/x). When OFF, the
-- subdomain serves normally. Enforced in middleware via /api/domains/lookup.
-- =============================================================================

begin;

alter table public.user_profiles
  add column if not exists subdomain_redirect_to_custom boolean not null default false;

commit;
