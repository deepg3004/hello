-- =============================================================================
-- 009 — order bump tracking on orders
--
-- The bump is captured as a second `orders` row (source='bump',
-- parent_order_id = main order) so the per-product accounting is clean and
-- the upsell dashboard can aggregate over `source` directly. We also stash
-- the bump amount + title on the parent row for quick "did this order
-- include a bump" lookups.
-- =============================================================================

begin;

alter table public.orders
  add column if not exists bump_product_id uuid references public.products(id) on delete set null,
  add column if not exists bump_amount      decimal(10, 2),
  add column if not exists bump_title       text,
  add column if not exists bump_offered     boolean default false,
  add column if not exists bump_accepted    boolean default false,
  add column if not exists oto_offered      boolean default false,
  add column if not exists oto_accepted     boolean default false;

create index if not exists orders_parent_order_id_idx on public.orders(parent_order_id);
create index if not exists orders_source_idx          on public.orders(source);

commit;
