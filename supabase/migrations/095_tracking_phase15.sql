-- =============================================================================
-- 095 — Phase 15 (Ads Tracking + Analytics), slice 1.
--
-- EXTENDS the existing per-tenant pixel system rather than creating parallel
-- tables (marketing_integrations = the tenant tracking settings;
-- storefront_events = the page-event store). Purely additive.
--
--  1. marketing_integrations: per-provider enable toggles + status, so the
--     new /dashboard/tracking UI can turn a pixel on/off without clearing the
--     ID, and so injection (MarketingScripts) can respect the toggle.
--  2. storefront_events: the columns needed to turn raw page views into real
--     visitor/session/funnel/campaign analytics (the old table only had
--     path/source/referrer).
-- =============================================================================

begin;

-- ── 1. Tenant tracking settings (on the existing marketing_integrations) ──────
alter table public.marketing_integrations
  add column if not exists enable_meta_pixel       boolean not null default true,
  add column if not exists enable_ga4              boolean not null default true,
  add column if not exists enable_google_ads       boolean not null default true,
  add column if not exists enable_advanced_matching boolean not null default false,
  add column if not exists enable_consent_mode     boolean not null default false,
  add column if not exists status                  text    not null default 'active'
    check (status in ('active', 'inactive', 'error'));

-- ── 2. Enrich the page-event store ───────────────────────────────────────────
alter table public.storefront_events
  add column if not exists visitor_id   text,
  add column if not exists session_id   text,
  add column if not exists event_name   text,          -- e.g. PageView, ViewContent
  add column if not exists page_type    text,          -- payment/landing/course/builder/store…
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists utm_content  text,
  add column if not exists utm_term     text,
  add column if not exists device_type  text,          -- mobile/tablet/desktop
  add column if not exists browser      text,
  add column if not exists order_id     uuid,
  add column if not exists product_id   uuid,
  add column if not exists event_value  numeric(12,2),
  add column if not exists currency     text,
  add column if not exists meta         jsonb not null default '{}'::jsonb;

-- Fast "events for this visitor/session" + campaign breakdowns.
create index if not exists storefront_events_visitor_idx
  on public.storefront_events (seller_user_id, visitor_id, created_at desc);
create index if not exists storefront_events_event_idx
  on public.storefront_events (seller_user_id, event_name, created_at desc);

commit;
