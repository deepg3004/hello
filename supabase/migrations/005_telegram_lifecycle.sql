-- =============================================================================
-- 005 — Telegram VIP lifecycle
--
-- Adds the columns the post-purchase + cron loop needs:
--   orders.telegram_invite_link            (one-time invite emitted on capture)
--   telegram_vip_groups.auto_renewal_enabled
--   telegram_vip_groups.webhook_set_at
--   telegram_vip_groups.bot_username       (cache from getMe)
--   telegram_memberships.reminder_3d_sent_at
--   telegram_memberships.reminder_1d_sent_at
--   telegram_memberships.bot_token_snapshot (so kicks survive token rotation)
-- =============================================================================

begin;

alter table public.orders
  add column if not exists telegram_invite_link text;

alter table public.telegram_vip_groups
  add column if not exists auto_renewal_enabled boolean default false,
  add column if not exists webhook_set_at timestamptz,
  add column if not exists bot_username text;

alter table public.telegram_memberships
  add column if not exists reminder_3d_sent_at timestamptz,
  add column if not exists reminder_1d_sent_at timestamptz,
  add column if not exists bot_token_snapshot text,
  add column if not exists group_chat_id text;

create index if not exists telegram_memberships_expires_at_idx
  on public.telegram_memberships(expires_at);
create index if not exists telegram_memberships_status_idx
  on public.telegram_memberships(status);

commit;
