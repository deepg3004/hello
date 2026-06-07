-- Per-purchase digital download grants. One row per (paid order, digital
-- product); a secret token drives /download/<token>. download_limit (nullable =
-- unlimited) is enforced atomically by consume_download_grant().

create table if not exists public.download_grants (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  seller_user_id  uuid not null references public.user_profiles(id),
  buyer_email     text not null,
  token           text not null unique,
  file_url        text not null,
  file_name       text,
  download_limit  integer,
  downloads_used  integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (order_id, product_id)
);

create index if not exists download_grants_buyer_email_idx on public.download_grants (buyer_email);

alter table public.download_grants enable row level security;
-- No policies: access is service-role only (server resolves grants by token /
-- by authenticated buyer email).

-- Atomically consume one download if under the limit. Returns the grant row on
-- success, NULL when the token is unknown or the limit is already reached.
create or replace function public.consume_download_grant(p_token text)
returns public.download_grants
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.download_grants;
begin
  update public.download_grants
     set downloads_used = downloads_used + 1
   where token = p_token
     and (download_limit is null or downloads_used < download_limit)
   returning * into g;
  return g;
end;
$$;
