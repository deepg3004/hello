-- =============================================================================
-- 008 — payouts dispatch pipeline
--
-- Adds:
--   payouts.scheduled_at / cancelled_at / cancelled_by_admin_id / notes /
--     reference_id / gateway_dispatch_payload (audit)
--   user_profiles.payout_gateway / payout_schedule / payout_min_threshold /
--     cashfree_beneficiary_id
-- =============================================================================

begin;

-- ---- payouts extras --------------------------------------------------------
alter table public.payouts
  add column if not exists scheduled_at             timestamptz,
  add column if not exists cancelled_at             timestamptz,
  add column if not exists cancelled_by_admin_id    uuid references public.user_profiles(id),
  add column if not exists notes                    text,
  add column if not exists reference_id             text,
  add column if not exists gateway_dispatch_payload jsonb,
  add column if not exists approved_at              timestamptz,
  add column if not exists approved_by_admin_id     uuid references public.user_profiles(id);

create index if not exists payouts_status_scheduled_idx
  on public.payouts(status, scheduled_at)
  where status = 'pending';

-- ---- user_profiles payout settings -----------------------------------------
alter table public.user_profiles
  add column if not exists payout_gateway        text default 'razorpay'
    check (payout_gateway in ('razorpay', 'cashfree', 'manual')),
  add column if not exists payout_schedule       text default 'manual'
    check (payout_schedule in ('manual', 'weekly', 'monthly')),
  add column if not exists payout_min_threshold  integer default 500,
  add column if not exists cashfree_beneficiary_id text;

commit;
