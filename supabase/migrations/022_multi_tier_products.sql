-- =============================================================================
-- 022 — multi-tier products + subscription metadata
--
-- Lets a single page expose N pricing tiers (Weekly / Monthly / Yearly /
-- Lifetime), shown as a picker on the public page. Buyer picks one → checkout
-- runs against the selected product_id → post-payment invite uses the
-- product's subscription_days (e.g. 30, 365, NULL=lifetime) instead of the
-- group's single access_duration_days.
--
-- New columns are all nullable / defaulted so existing single-product pages
-- keep working unchanged.
-- =============================================================================

begin;

alter table public.products
  -- 7, 30, 365, etc. NULL means "no expiry" (lifetime). Fallback to
  -- telegram_vip_groups.access_duration_days when NULL on a Telegram tier.
  add column if not exists subscription_days integer,
  -- Short user-facing label rendered on the tier card ("Monthly", "Yearly")
  add column if not exists display_label text,
  -- Tier ordering — smaller = earlier. Defaults to 0 so existing rows still
  -- sort by created_at as a secondary key.
  add column if not exists sort_order integer default 0;

-- Index for the public-page query "give me all active products for page X,
-- ordered by tier"
create index if not exists products_page_active_sort_idx
  on public.products(page_id, sort_order, created_at)
  where active = true and page_id is not null;

notify pgrst, 'reload schema';

commit;
