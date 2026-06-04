-- =============================================================================
-- 054 — account-wide Marketing Integrations (Session 13)
--
-- One row per seller. Account-level tracking pixels (applied to the seller's
-- storefront + site, complementing the per-page pixel_configs) plus an outbound
-- webhook fired on key events (order paid, lead, booking) for Zapier/Make/etc.
-- Service-role only (RLS on, no policies).
-- =============================================================================

begin;

create table if not exists public.marketing_integrations (
  user_id          uuid primary key references public.user_profiles(id) on delete cascade,
  meta_pixel_id    text,
  ga4_id           text,
  google_ads_id    text,
  tiktok_pixel_id  text,
  custom_head_html text,
  webhook_url      text,
  webhook_events   text[] not null default '{order_paid,lead_created,booking_created}',
  active           boolean not null default true,
  updated_at       timestamptz default now()
);

alter table public.marketing_integrations enable row level security;

commit;
