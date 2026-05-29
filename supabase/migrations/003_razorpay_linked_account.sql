-- =============================================================================
-- 003 — store the seller's Razorpay Route linked account
--
-- Once a seller passes KYC level 2 (bank verified), we create a Razorpay
-- linked account so commission splits route automatically on capture.
-- =============================================================================

begin;

alter table public.user_profiles
  add column if not exists razorpay_linked_account_id text;

comment on column public.user_profiles.razorpay_linked_account_id is
  'Razorpay Route linked account id. Receives the seller_amount portion on capture.';

commit;
