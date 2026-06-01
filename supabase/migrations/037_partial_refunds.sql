-- =============================================================================
-- 037 — Partial refunds.
--
-- Adds a running refunded_amount tally on orders and widens the status CHECK
-- to allow 'partially_refunded'. The status constraint is dropped by its
-- actual name (found dynamically) so this works regardless of how it was named.
-- =============================================================================

begin;

alter table public.orders
  add column if not exists refunded_amount numeric not null default 0;

do $$
declare
  cname text;
begin
  select conname into cname
    from pg_constraint
   where conrelid = 'public.orders'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%status%in%';
  if cname is not null then
    execute format('alter table public.orders drop constraint %I', cname);
  end if;
end $$;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'paid', 'failed', 'refunded', 'cancelled', 'partially_refunded'));

commit;
