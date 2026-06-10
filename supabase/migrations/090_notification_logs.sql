-- =============================================================================
-- 090 — notification delivery log (external channels)
--
-- Email / WhatsApp / SMS sends previously left no audit trail — when a receipt
-- or recovery message didn't arrive, there was no way to see whether it was
-- sent, skipped (provider unconfigured), or failed. This records one row per
-- external send attempt, written best-effort from the send chokepoints.
--
-- In-app notifications are deliberately NOT logged here — the `notifications`
-- table (033) already IS their audit. We store only metadata (recipient,
-- subject, status) — never message bodies, so OTP/receipt contents stay out.
--
-- Service-role only (RLS on, no policies → never readable from the browser).
-- =============================================================================

begin;

create table if not exists public.notification_logs (
  id              uuid primary key default gen_random_uuid(),
  channel         text not null check (channel in ('email', 'whatsapp', 'sms')),
  event_key       text,                       -- template/event name when known
  recipient       text not null,              -- email address or E.164 phone
  subject         text,                       -- subject/title only, never the body
  seller_user_id  uuid references public.user_profiles(id) on delete set null,
  status          text not null check (status in ('sent', 'failed', 'skipped')),
  provider        text,                       -- resend/smtp/twilio
  error           text,
  created_at      timestamptz not null default now()
);

create index if not exists notification_logs_created_idx
  on public.notification_logs(created_at desc);
create index if not exists notification_logs_channel_idx
  on public.notification_logs(channel, created_at desc);
create index if not exists notification_logs_status_idx
  on public.notification_logs(status) where status = 'failed';

alter table public.notification_logs enable row level security;

commit;
