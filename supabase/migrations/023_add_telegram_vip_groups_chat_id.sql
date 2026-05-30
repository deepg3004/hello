-- =============================================================================
-- 023 — add telegram_vip_groups.group_chat_id
--
-- Why:
--   saveTelegramSetupAction (actions/telegram.ts) inserts a row that includes
--   group_chat_id — the numeric chat id we get back from verifyBotInGroup.
--   It's distinct from group_id which historically held the human-supplied
--   string (could be @groupname, an invite link fragment, or a numeric id).
--
--   Migration 005 added group_chat_id to telegram_memberships (used by the
--   cron loop) but never to telegram_vip_groups itself. Every wizard
--   "Finish setup" click hit "Could not find the 'group_chat_id' column".
-- =============================================================================

begin;

alter table public.telegram_vip_groups
  add column if not exists group_chat_id text;

create index if not exists telegram_vip_groups_group_chat_id_idx
  on public.telegram_vip_groups(group_chat_id) where group_chat_id is not null;

notify pgrst, 'reload schema';

commit;
