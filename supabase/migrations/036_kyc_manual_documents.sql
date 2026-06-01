-- =============================================================================
-- 036 — Extra KYC document slots for the manual-submission flow.
--
-- Manual KYC (used when automated Surepass verification is unavailable) lets
-- sellers upload supporting images and an Aadhaar number for an admin to
-- verify by hand. These columns hold the storage paths (signed on read).
-- =============================================================================

begin;

alter table public.kyc_submissions
  add column if not exists aadhaar_number      text,
  add column if not exists pan_front_url        text,
  add column if not exists pan_back_url         text,
  add column if not exists aadhaar_front_url    text,
  add column if not exists aadhaar_back_url     text,
  add column if not exists bank_statement_url   text,
  add column if not exists cancel_cheque_url    text;

commit;
