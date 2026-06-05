-- =============================================================================
-- 066 — product variants (store) + cart promo + invoice line columns
--
-- product_variants: per-option price/stock/sku for a catalog product (e.g.
-- "Large / Red"). A product with variants is bought by picking a variant; the
-- variant's price + stock win. order_items records which variant was bought.
-- =============================================================================

begin;

create table if not exists public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name       text not null,                 -- e.g. "Large / Red"
  price      decimal(10, 2) not null,
  stock      integer,                        -- NULL = untracked
  sku        text,
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists product_variants_product_idx
  on public.product_variants(product_id);

-- order_items learns which variant a line was.
alter table public.order_items
  add column if not exists variant_id uuid,
  add column if not exists variant_name text;

alter table public.product_variants enable row level security;

-- A stock decrement RPC for a variant (mirrors decrement_product_stock).
create or replace function public.decrement_variant_stock(p_variant_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.product_variants
     set stock = greatest(stock - 1, 0)
   where id = p_variant_id and stock is not null;
$$;
grant execute on function public.decrement_variant_stock(uuid) to service_role, authenticated;

commit;
