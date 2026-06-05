-- =============================================================================
-- 061 — Store Phase 2a: collections + catalog products
--
-- collections          — a seller's merchandising group (e.g. "Bestsellers").
-- collection_products  — many-to-many: a product can sit in several collections.
-- products.is_catalog  — marks products created/managed from the Store dashboard
--                        (vs pricing tiers authored under a sales page). Each
--                        catalog product still gets its own published payment
--                        page so the EXISTING single-item checkout works
--                        unchanged — no money-path change in this phase.
--
-- Service-role is the writer (dashboard uses the admin client); owner RLS on
-- collections is defense-in-depth, mirroring the other seller tables.
-- =============================================================================

begin;

create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.user_profiles(id) on delete cascade,
  name        text not null,
  slug        text not null,
  description text,
  image_url   text,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, slug)
);
create index if not exists collections_user_idx on public.collections(user_id);

create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  sort_order    integer not null default 0,
  primary key (collection_id, product_id)
);
create index if not exists collection_products_product_idx
  on public.collection_products(product_id);

alter table public.products
  add column if not exists is_catalog boolean not null default false;

alter table public.collections enable row level security;
alter table public.collection_products enable row level security;

drop policy if exists "collections owner" on public.collections;
create policy "collections owner" on public.collections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;
