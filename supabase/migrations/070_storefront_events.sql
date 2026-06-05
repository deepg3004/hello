-- =============================================================================
-- 070 — storefront click-source analytics.
--
-- One row per storefront page view, recording where the visitor came from
-- (source path, captured from the header logo's ?from= link + referrer) and
-- where they landed (path). Powers the Analytics tab in Storefront Design.
-- =============================================================================

begin;

create table if not exists public.storefront_events (
  id             uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references public.user_profiles(id) on delete cascade,
  type           text not null default 'pageview',
  path           text,    -- destination (buyer-visible) path
  source         text,    -- where the click came from (?from=)
  referrer       text,    -- document.referrer host (external sources)
  created_at     timestamptz not null default now()
);
create index if not exists storefront_events_seller_time_idx
  on public.storefront_events(seller_user_id, created_at desc);

alter table public.storefront_events enable row level security;

commit;
