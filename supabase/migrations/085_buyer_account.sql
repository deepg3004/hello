-- Buyer account: wishlist + saved address book. Keyed by buyer email (the
-- buyer-portal identity, cross-seller). Accessed only via the service-role
-- admin client gated by a verified buyer session (same pattern as orders on
-- /account); RLS is enabled with no policies so direct anon/auth access is
-- denied while the service role bypasses it.

create table if not exists buyer_wishlist (
  id uuid primary key default gen_random_uuid(),
  buyer_email text not null,
  page_id uuid references pages(id) on delete cascade,
  seller_user_id uuid,
  title text,
  created_at timestamptz not null default now(),
  unique (buyer_email, page_id)
);
create index if not exists idx_buyer_wishlist_email on buyer_wishlist (buyer_email);

create table if not exists buyer_addresses (
  id uuid primary key default gen_random_uuid(),
  buyer_email text not null,
  full_name text not null,
  phone text,
  line1 text not null,
  line2 text,
  city text not null,
  state text,
  pincode text not null,
  country text not null default 'India',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_buyer_addresses_email on buyer_addresses (buyer_email);

alter table buyer_wishlist enable row level security;
alter table buyer_addresses enable row level security;
