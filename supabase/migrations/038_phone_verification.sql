-- =============================================================================
-- 038 — Phone (SMS OTP) verification for new sellers.
--
-- After signup, a seller must verify their phone via a 6-digit SMS OTP before
-- the dashboard unlocks. These columns hold the verified flag plus the same
-- hashed-OTP / expiry / attempts shape used by the WhatsApp verify flow.
--
-- Existing users are grandfathered (phone_verified = true) so only NEW signups
-- are gated — a deliverability hiccup must never lock out current sellers.
-- =============================================================================

begin;

alter table public.user_profiles
  add column if not exists phone_verified        boolean     not null default false,
  add column if not exists phone_verified_at     timestamptz,
  add column if not exists phone_otp_hash        text,
  add column if not exists phone_otp_expires_at  timestamptz,
  add column if not exists phone_otp_attempts    integer     not null default 0,
  add column if not exists phone_pending_number  text;

-- Grandfather everyone who already has an account.
update public.user_profiles
  set phone_verified = true, phone_verified_at = coalesce(phone_verified_at, now())
  where phone_verified = false;

commit;
