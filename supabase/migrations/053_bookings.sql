-- =============================================================================
-- 053 — Bookings / scheduling (Session 11)
--
-- booking_types        — a seller's bookable offering (1:1 call, consult, …).
--                        price = 0 → free booking; > 0 → paid via seller gateway.
-- booking_availability — weekly recurring windows per booking type.
-- bookings             — actual reservations (free → confirmed; paid → pending
--                        until the seller-gateway payment is verified).
-- Service-role only (RLS on, no policies). Public reads go through the server.
-- =============================================================================

begin;

create table if not exists public.booking_types (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.user_profiles(id) on delete cascade,
  slug         text not null unique,
  title        text not null,
  description  text,
  duration_min integer not null default 30,
  buffer_min   integer not null default 0,
  price        decimal(10, 2) not null default 0,  -- 0 = free
  currency     text not null default 'INR',
  location     text,                                -- "Google Meet", "Phone", address…
  active       boolean not null default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists booking_types_user_idx on public.booking_types(user_id);

create table if not exists public.booking_availability (
  id              uuid primary key default gen_random_uuid(),
  booking_type_id uuid not null references public.booking_types(id) on delete cascade,
  weekday         smallint not null check (weekday between 0 and 6),  -- 0=Sun
  start_min       integer not null check (start_min between 0 and 1440),
  end_min         integer not null check (end_min between 0 and 1440)
);
create index if not exists booking_availability_type_idx
  on public.booking_availability(booking_type_id);

create table if not exists public.bookings (
  id              uuid primary key default gen_random_uuid(),
  booking_type_id uuid not null references public.booking_types(id) on delete cascade,
  seller_user_id  uuid not null references public.user_profiles(id) on delete cascade,
  buyer_name      text,
  buyer_email     text not null,
  buyer_phone     text,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  status          text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'cancelled')),
  order_id        uuid,
  amount          decimal(10, 2) not null default 0,
  gateway_order_id text,
  created_at      timestamptz default now()
);
create index if not exists bookings_type_start_idx
  on public.bookings(booking_type_id, start_at);
create index if not exists bookings_seller_idx
  on public.bookings(seller_user_id, start_at);
-- A confirmed/pending booking holds a slot — block a second one at the same time.
create unique index if not exists bookings_slot_unique
  on public.bookings(booking_type_id, start_at)
  where status in ('pending', 'confirmed');

alter table public.booking_types enable row level security;
alter table public.booking_availability enable row level security;
alter table public.bookings enable row level security;

commit;
