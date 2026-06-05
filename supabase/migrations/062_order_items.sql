-- =============================================================================
-- 062 — Store Phase 2b: order_items (multi-item cart)
--
-- A cart checkout creates ONE order header (one Razorpay order on the seller's
-- own gateway — one seller per cart, forced by the no-funds model) with N
-- order_items lines. Legacy single-item orders keep working unchanged (they
-- have no order_items rows; fulfillment falls back to orders.product_id).
--
-- v1 carts hold only catalog/store products (products.is_catalog) — plain
-- payment pages with no membership/course/Telegram/Discord access to fan out —
-- so fulfillment is stock + invoice + receipt only. Service-role writer.
-- =============================================================================

begin;

create table if not exists public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  product_id        uuid references public.products(id) on delete set null,
  name_snapshot     text not null,
  unit_price        decimal(10, 2) not null,   -- rupees, at time of purchase
  quantity          integer not null default 1 check (quantity > 0),
  line_amount       decimal(10, 2) not null,   -- unit_price * quantity
  requires_shipping boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_product_idx on public.order_items(product_id);

alter table public.order_items enable row level security;

commit;
