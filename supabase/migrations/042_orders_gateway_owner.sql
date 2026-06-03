-- =============================================================================
-- 042 — orders.gateway_owner
--
-- Records which gateway account an order was created on:
--   'platform' — InvoxAI's own Razorpay (current/default behaviour)
--   'seller'   — the seller's own connected gateway (Phase 4, multi-gateway)
--
-- verify-payment uses this to pick the correct secret when validating the
-- in-checkout signature. Default 'platform' keeps every existing + flag-off
-- order on the platform path.
-- =============================================================================

begin;

alter table public.orders
  add column if not exists gateway_owner text not null default 'platform'
    check (gateway_owner in ('platform', 'seller'));

commit;
