-- =============================================================================
-- 069 — per-seller storefront design config (store + course pages).
--
-- storefront_config = { store: SurfaceConfig, course: SurfaceConfig } — chosen
-- theme, accent/font overrides, hero/card/radius/density, section toggles and
-- custom copy. Resolved + defaulted in lib/storefront-theme.ts.
-- =============================================================================

begin;

alter table public.user_profiles
  add column if not exists storefront_config jsonb not null default '{}'::jsonb;

commit;
