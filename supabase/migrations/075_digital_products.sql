-- Digital products: an explicit product type (digital | physical | service),
-- an optional downloadable file, and a per-buyer download limit. The file lives
-- in a PRIVATE bucket and is delivered via signed URLs after payment (see the
-- download-grants flow).

alter table public.products
  add column if not exists product_type text not null default 'digital'
    check (product_type in ('digital', 'physical', 'service')),
  add column if not exists file_url text,
  add column if not exists file_name text,
  add column if not exists download_limit integer;

-- Backfill: anything that collected shipping is a physical product.
update public.products set product_type = 'physical' where requires_shipping = true;

-- Private bucket for paid digital files (signed-URL access only).
insert into storage.buckets (id, name, public)
values ('product-files', 'product-files', false)
on conflict (id) do nothing;
