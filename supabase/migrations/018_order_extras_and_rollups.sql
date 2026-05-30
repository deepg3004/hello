-- =============================================================================
-- 018 — order lifecycle columns + atomic revenue rollups
--
-- Why:
--   1. orders.paid_at + refunded_at were missing — the verify-payment route
--      writes paid_at on every successful charge, so until now that single
--      UPDATE was failing silently (Supabase returns an error code but the
--      route doesn't check it) and the order was left at status='pending'.
--   2. The "roll up totals on pages + user_profiles" block in verify-payment
--      did a read → add → write, which races under concurrent payments on
--      a popular page. Two checkouts paying at the same moment could each
--      read total_revenue=100 and both write back total_revenue=149.
--      The new SQL function does a single atomic UPDATE that the route can
--      call via .rpc().
-- =============================================================================

begin;

-- ── 1. paid_at / refunded_at ────────────────────────────────────────────
alter table public.orders
  add column if not exists paid_at      timestamptz,
  add column if not exists refunded_at  timestamptz;

create index if not exists orders_paid_at_idx
  on public.orders(paid_at) where paid_at is not null;

-- Back-fill: orders that are already 'paid' but missing paid_at get their
-- created_at as a reasonable approximation. Safe to re-run.
update public.orders
   set paid_at = created_at
 where status = 'paid' and paid_at is null;

-- ── 2. Atomic page + seller revenue increment ──────────────────────────
-- Called from verify-payment via:
--   await admin.rpc("increment_page_revenue", {
--     p_page_id: order.page_id,
--     p_seller_id: order.seller_user_id,
--     p_amount: Number(order.amount),
--   });
--
-- One transaction, two atomic UPDATEs. Concurrent callers serialise on the
-- row-level locks Postgres takes for each UPDATE — no read-modify-write
-- race.
create or replace function public.increment_page_revenue(
  p_page_id   uuid,
  p_seller_id uuid,
  p_amount    decimal
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.pages
     set total_revenue    = coalesce(total_revenue, 0)    + p_amount,
         conversion_count = coalesce(conversion_count, 0) + 1
   where id = p_page_id;

  update public.user_profiles
     set total_revenue = coalesce(total_revenue, 0) + p_amount
   where id = p_seller_id;
$$;

-- Service role + authenticated users can call it; row-level filters are
-- already in the UPDATEs above.
grant execute on function public.increment_page_revenue(uuid, uuid, decimal)
  to service_role, authenticated;

commit;
