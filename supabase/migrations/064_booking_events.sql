-- =============================================================================
-- 064 — Group / event bookings (Session 11 follow-up)
--
-- A booking_event is ONE fixed date/time that MANY attendees register for, up to
-- an optional capacity. Separate from 1:1 bookings: the bookings table is
-- NOT-NULL booking_type_id with a unique (booking_type_id, start_at) slot index
-- that allows only one booking per slot — the opposite of a group event.
--
-- Capacity is enforced atomically by register_for_event() (row-locks the event,
-- counts pending+confirmed regs, rejects when full) — a count<N rule can't be a
-- CHECK/unique constraint. Mirrors the deduct_wallet_balance / decrement_product
-- _stock RPC pattern. Service-role only (RLS on, no policies).
-- =============================================================================

begin;

create table if not exists public.booking_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.user_profiles(id) on delete cascade,
  slug        text not null unique,
  title       text not null,
  description text,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  capacity    integer,                         -- NULL = unlimited
  price       decimal(10, 2) not null default 0,
  currency    text not null default 'INR',
  location    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists booking_events_user_idx on public.booking_events(user_id);

create table if not exists public.event_registrations (
  id               uuid primary key default gen_random_uuid(),
  booking_event_id uuid not null references public.booking_events(id) on delete cascade,
  buyer_name       text,
  buyer_email      text not null,
  buyer_phone      text,
  status           text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'cancelled')),
  order_id         uuid,
  amount           decimal(10, 2) not null default 0,
  gateway_order_id text,
  created_at       timestamptz not null default now()
);
create index if not exists event_reg_event_idx
  on public.event_registrations(booking_event_id, status);
create index if not exists event_reg_email_idx
  on public.event_registrations(booking_event_id, buyer_email);

alter table public.booking_events enable row level security;
alter table public.event_registrations enable row level security;

-- ── Atomic capacity-guarded registration ────────────────────────────────────
-- Returns the new registration id, or NULL when the event is missing/inactive
-- or full. Row-locks the event so concurrent registrations see a consistent
-- count. p_status = 'confirmed' (free) or 'pending' (paid, holds a seat).
create or replace function public.register_for_event(
  p_event_id         uuid,
  p_buyer_name       text,
  p_buyer_email      text,
  p_buyer_phone      text,
  p_status           text default 'confirmed',
  p_amount           numeric default 0,
  p_gateway_order_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap   integer;
  v_count integer;
  v_id    uuid;
begin
  select capacity into v_cap
    from public.booking_events
   where id = p_event_id and active = true
   for update;
  if not found then
    return null;  -- missing / inactive
  end if;

  if v_cap is not null then
    -- Confirmed seats + still-fresh pending holds. A pending hold from an
    -- abandoned paid checkout stops consuming capacity after 15 minutes, so the
    -- seat frees itself without needing a sweeper job.
    select count(*) into v_count
      from public.event_registrations
     where booking_event_id = p_event_id
       and (
         status = 'confirmed'
         or (status = 'pending' and created_at > now() - interval '15 minutes')
       );
    if v_count >= v_cap then
      return null;  -- full
    end if;
  end if;

  insert into public.event_registrations
    (booking_event_id, buyer_name, buyer_email, buyer_phone, status, amount, gateway_order_id)
  values
    (p_event_id, p_buyer_name, p_buyer_email, p_buyer_phone, p_status, p_amount, p_gateway_order_id)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.register_for_event(uuid, text, text, text, text, numeric, text)
  to service_role, authenticated;

commit;
