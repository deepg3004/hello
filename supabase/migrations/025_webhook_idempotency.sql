-- =============================================================================
-- 025 — Webhook idempotency + refund-flow schema bumps
--
-- Audit findings addressed (CRITICAL):
--   * Webhook double-credit race: every webhook handler now inserts
--     (provider, event_id) into webhook_events_processed BEFORE any side
--     effect, so a duplicate Razorpay delivery hits the PK conflict and
--     exits cleanly without writing a second ledger row.
--   * Refund flow ledger reversal: previously refundOrderAction was a stub
--     that only flipped orders.status='refunded'. Now it calls
--     Razorpay payments.refund() AND writes negating transactions rows AND
--     marks affiliate_payouts as 'reversed'. The columns/values added below
--     are what that flow needs.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. webhook_events_processed — idempotency ledger for ALL webhook providers.
--    Cron retention: prune > 90 days in a future scheduled job.
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_events_processed (
  provider     text        not null,  -- 'razorpay' | 'resend' | 'telegram'
  event_id     text        not null,  -- razorpay event id, svix id, etc.
  event_type   text,                  -- 'payment.captured' etc. (debug)
  resource_id  text,                  -- payment id / order id / message id
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);

create index if not exists webhook_events_processed_processed_at_idx
  on public.webhook_events_processed(processed_at);

alter table public.webhook_events_processed enable row level security;
-- Service-role only — no policies, no client access.

-- ---------------------------------------------------------------------------
-- 2. orders.refund_id — track the Razorpay refund id for the reversal so
--    a later support ticket can be traced from our DB to the Razorpay
--    dashboard without a fuzzy time-range search.
--    refunded_at already exists (migration 018).
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists refund_id text;

-- ---------------------------------------------------------------------------
-- 3. affiliate_payouts.reversed_at + extend status enum to include
--    'reversed'. Used by refundOrderAction to claw back commission on
--    refunded sales.
--    Drop + re-add the CHECK because it has a hardcoded value list. The
--    NOT VALID + VALIDATE dance lets us avoid a full-table scan lock if
--    a stray row is in flight.
-- ---------------------------------------------------------------------------
alter table public.affiliate_payouts
  add column if not exists reversed_at timestamptz;

alter table public.affiliate_payouts
  drop constraint if exists affiliate_payouts_status_check;
alter table public.affiliate_payouts
  add constraint affiliate_payouts_status_check
  check (status in ('pending', 'paid', 'cancelled', 'reversed')) not valid;
alter table public.affiliate_payouts
  validate constraint affiliate_payouts_status_check;

-- ---------------------------------------------------------------------------
-- 4. transactions.type — add the two refund-side types we now emit.
--    'refund_commission' = positive give-back of the platform's commission
--    when an order is refunded (so platform_earnings == sum(commission rows)
--    still holds).
--    'subscription_refund' = subscription_payment reversal from the
--    /razorpay/subscription webhook.
-- ---------------------------------------------------------------------------
alter table public.transactions
  drop constraint if exists transactions_type_check;
alter table public.transactions
  add constraint transactions_type_check
  check (type in (
    'sale',
    'commission',
    'payout',
    'refund',
    'refund_commission',
    'subscription_payment',
    'subscription_refund'
  )) not valid;
alter table public.transactions
  validate constraint transactions_type_check;
