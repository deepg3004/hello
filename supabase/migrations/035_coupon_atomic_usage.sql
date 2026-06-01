-- =============================================================================
-- 035 — Atomic coupon usage increment (fixes over-redemption race).
--
-- The app previously incremented usage_count with a client-computed value
-- (read current → write current+1) guarded by a `usage_count < limit` filter.
-- Two concurrent buyers could read the same `current` and both write the same
-- `current+1`, a classic lost-update → a total_limit=1 coupon redeemed twice.
--
-- This function performs the gate-and-increment in a SINGLE UPDATE. The row
-- lock serialises concurrent callers, so the cap holds exactly. Returns true
-- when a slot was consumed, false when the coupon is already at its limit.
-- =============================================================================

begin;

create or replace function public.increment_coupon_usage(p_coupon_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  did boolean;
begin
  update public.coupons
     set usage_count = coalesce(usage_count, 0) + 1
   where id = p_coupon_id
     and (total_limit is null or coalesce(usage_count, 0) < total_limit)
  returning true into did;

  return coalesce(did, false);
end;
$$;

commit;
