-- =============================================================================
-- 094 — Buyer-initiated refund/cancel requests.
--
-- A buyer can request a refund on a PAID order from their account. This adds a
-- tracked status on the order so the request shows up in the seller's
-- transactions queue (not just an email). The seller resolves it by issuing the
-- existing refund (order → 'refunded' supersedes the request) or declining it.
--
-- Additive columns only. No money-path change — the actual refund still goes
-- through refundOrderAction / order-reversal unchanged.
-- =============================================================================

begin;

alter table public.orders
  add column if not exists refund_request_status text not null default 'none'
    check (refund_request_status in ('none', 'requested', 'declined')),
  add column if not exists refund_requested_at  timestamptz,
  add column if not exists refund_request_reason text;

-- Seller queue lookup: only the orders awaiting a decision.
create index if not exists orders_refund_requested_idx
  on public.orders (seller_user_id, refund_requested_at desc)
  where refund_request_status = 'requested';

commit;
