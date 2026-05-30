-- =============================================================================
-- 021 — sweep all columns the code uses but no migration created
--
-- Why:
--   We've been reactively finding missing columns one at a time (published_at,
--   image_url, experiment_status). This migration applies a full audit sweep
--   of every Supabase column the code references but no migration creates.
--
--   See AUDIT_NOTES below for the source file/line of each reference.
-- =============================================================================
--
-- AUDIT NOTES:
--   pages.telegram_group_id           : actions/telegram.ts:157, app/api/checkout/verify-payment/route.ts:505
--   telegram_memberships.telegram_group_id: actions/telegram.ts:236,248,345; api/cron/telegram-expiries:67,77; api/webhooks/telegram:87,107,135,140
--   telegram_memberships.invited_at   : actions/telegram.ts:349; cron:67; webhook:90; admin/telegram/page.tsx:19,33
--   telegram_memberships.status='invited': not allowed by 001 CHECK constraint
--   lead_captures.source              : api/lead-captures/route.ts:127; dashboard/leads/page.tsx:22,45,65
--   lead_captures.utm (jsonb)         : api/lead-captures/route.ts:128; dashboard/leads/page.tsx:22,46,66
--   abandoned_checkouts.recovery_step : lib/recovery-runner.ts:146,184,259,274; dashboard/analytics:36,84
-- =============================================================================

begin;

-- ── pages: Telegram VIP group linkage ──────────────────────────────────────
alter table public.pages
  add column if not exists telegram_group_id uuid
    references public.telegram_vip_groups(id) on delete set null;

create index if not exists pages_telegram_group_id_idx
  on public.pages(telegram_group_id);

-- ── telegram_memberships: lifecycle code expects telegram_group_id ─────────
alter table public.telegram_memberships
  add column if not exists telegram_group_id uuid
    references public.telegram_vip_groups(id) on delete cascade,
  add column if not exists invited_at timestamptz;

create index if not exists telegram_memberships_telegram_group_id_idx
  on public.telegram_memberships(telegram_group_id);
create index if not exists telegram_memberships_invited_at_idx
  on public.telegram_memberships(invited_at);

-- Allow 'invited' as a status — issueInviteForOrder inserts with this status,
-- the webhook flips it to 'active' when the member actually joins.
alter table public.telegram_memberships
  drop constraint if exists telegram_memberships_status_check;
alter table public.telegram_memberships
  add constraint telegram_memberships_status_check
  check (status in ('active', 'expired', 'removed', 'invited'));

-- ── lead_captures: source + utm jsonb ──────────────────────────────────────
alter table public.lead_captures
  add column if not exists source text,
  add column if not exists utm    jsonb default '{}'::jsonb;

-- ── abandoned_checkouts: recovery_step counter ─────────────────────────────
alter table public.abandoned_checkouts
  add column if not exists recovery_step integer default 0;

notify pgrst, 'reload schema';

commit;
