-- =============================================================================
-- 052 — physical + digital store (Session 10, Phase 1)
--
-- Adds physical-product support: inventory, shipping address capture, shipping
-- fee, and order fulfillment tracking. All columns are nullable / defaulted so
-- existing digital products and orders are unaffected.
-- =============================================================================

begin;

-- ── products: physical attributes ──────────────────────────────────────────
alter table public.products
  add column if not exists requires_shipping boolean not null default false,
  -- NULL = not stock-tracked (unlimited, e.g. digital). >=0 = units in stock.
  add column if not exists stock          integer,
  add column if not exists sku            text,
  add column if not exists category       text,
  add column if not exists weight_grams   integer;

-- ── orders: shipping + fulfillment ─────────────────────────────────────────
alter table public.orders
  add column if not exists shipping_address   jsonb,
  add column if not exists shipping_fee       decimal(10, 2) not null default 0,
  add column if not exists fulfillment_status text not null default 'unfulfilled'
    check (fulfillment_status in ('unfulfilled', 'packed', 'shipped', 'delivered')),
  add column if not exists tracking_number    text,
  add column if not exists tracking_url       text,
  add column if not exists shipped_at         timestamptz;

create index if not exists orders_fulfillment_idx
  on public.orders(seller_user_id, fulfillment_status);

-- Atomic stock decrement (no-op for untracked/null stock; never goes negative).
create or replace function public.decrement_product_stock(p_product_id uuid)
returns void language sql as $$
  update public.products
     set stock = greatest(stock - 1, 0)
   where id = p_product_id
     and stock is not null;
$$;

-- ── seller-level shipping config ───────────────────────────────────────────
alter table public.user_profiles
  add column if not exists shipping_flat_fee   decimal(10, 2) not null default 0,
  -- Orders at/above this subtotal ship free. NULL/0 = never auto-free.
  add column if not exists free_shipping_over  decimal(10, 2);

commit;
