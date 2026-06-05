-- =============================================================================
-- 058 — TEARDOWN: drop the dormant payout + KYC schema (Session 19)
--
-- ⚠️ DESTRUCTIVE & IRREVERSIBLE. Run LAST, AFTER a fresh database backup, and
--    ONLY once every code branch that still referenced these objects is
--    deployed (the no-funds / own-gateway model — S2/S3 removed the seller
--    payout + KYC code; this session removed the last inert consumers:
--    lib/dashboard pending-payout stat, onboarding kyc fields, payout email
--    templates + their catalog/render/routing/drafts wiring).
--
-- Drops:
--   tables  : payouts, kyc_submissions, kyc_verification_logs
--   columns : user_profiles.{kyc_level, payouts_enabled, bank_account_number,
--             bank_ifsc, bank_holder_name, bank_verified, pan_number,
--             pan_verified, razorpay_linked_account_id, payout_gateway,
--             payout_schedule, payout_min_threshold, cashfree_beneficiary_id}
--   policies: orphaned kyc-documents storage.objects policies
--
-- KEEPS (intentionally — NOT seller payouts/KYC):
--   * affiliate_payouts          (affiliate commission ledger)
--   * affiliate_links.bank_*     (affiliate payout bank details — still live)
--   * user_profiles.gstin        (GST invoicing)
--   * user_profiles.razorpay_customer_id (buyer-side payments)
--
-- The private `kyc-documents` storage bucket and its objects are NOT removed
-- here (deleting stored PII is left as a deliberate manual step after backup):
--   -- delete from storage.objects where bucket_id = 'kyc-documents';
--   -- delete from storage.buckets where id = 'kyc-documents';
-- =============================================================================

begin;

-- ── tables (CASCADE clears dependent FKs/policies/constraints) ───────────────
drop table if exists public.kyc_verification_logs cascade;
drop table if exists public.kyc_submissions       cascade;
drop table if exists public.payouts               cascade;

-- ── user_profiles payout + KYC columns ───────────────────────────────────────
alter table public.user_profiles
  drop column if exists kyc_level,
  drop column if exists payouts_enabled,
  drop column if exists bank_account_number,
  drop column if exists bank_ifsc,
  drop column if exists bank_holder_name,
  drop column if exists bank_verified,
  drop column if exists pan_number,
  drop column if exists pan_verified,
  drop column if exists razorpay_linked_account_id,
  drop column if exists payout_gateway,
  drop column if exists payout_schedule,
  drop column if exists payout_min_threshold,
  drop column if exists cashfree_beneficiary_id;

-- ── orphaned KYC storage policies (the bucket+objects are kept; see header) ───
drop policy if exists "kyc_owner_upload" on storage.objects;
drop policy if exists "kyc_owner_read"   on storage.objects;
drop policy if exists "kyc_admin_read"   on storage.objects;

commit;
