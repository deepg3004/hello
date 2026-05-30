-- =============================================================================
-- 010 — seller notification preferences + WhatsApp OTP storage
--
-- Stores:
--   user_profiles.notifications_config jsonb — per-event toggles + verified
--                                              whatsapp number + email prefs
--   user_profiles.whatsapp_otp_hash / _expires_at / _pending_number
--                                            — used by the verify-whatsapp flow
-- =============================================================================

begin;

alter table public.user_profiles
  add column if not exists notifications_config        jsonb default '{}'::jsonb,
  add column if not exists whatsapp_pending_number     text,
  add column if not exists whatsapp_otp_hash           text,
  add column if not exists whatsapp_otp_expires_at     timestamptz,
  add column if not exists whatsapp_otp_attempts       integer default 0,
  add column if not exists whatsapp_verified_number    text,
  add column if not exists whatsapp_verified_at        timestamptz;

commit;
