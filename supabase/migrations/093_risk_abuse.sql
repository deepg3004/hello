-- =============================================================================
-- 093 — Risk & Abuse controls (Phase 13).
--
-- Two new capabilities on top of the existing rate-limit / suspension / audit
-- foundation:
--   1. risk_blocklist — an admin-managed denylist of emails / IPs / phones that
--      checkout (and other entry points) hard-block before doing any work.
--   2. order risk scoring — checkout flags suspicious orders (velocity,
--      duplicate, high-value) for manual admin review. Flagging never blocks a
--      payment; the blocklist is the only hard gate.
--
-- Service-role only (RLS on, no policies) — never read from the browser.
-- =============================================================================

begin;

-- ── Blocklist ───────────────────────────────────────────────────────────────
create table if not exists public.risk_blocklist (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('email', 'ip', 'phone')),
  value       text not null,                 -- normalised (email lowercased, etc.)
  reason      text,
  active      boolean not null default true,
  created_by  uuid references public.user_profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- One active rule per (kind, value); re-adding flips an old row back on.
create unique index if not exists risk_blocklist_kind_value_idx
  on public.risk_blocklist (kind, value);

create index if not exists risk_blocklist_active_idx
  on public.risk_blocklist (kind, value) where active;

alter table public.risk_blocklist enable row level security;

-- ── Order risk columns ───────────────────────────────────────────────────────
alter table public.orders
  add column if not exists risk_score    integer not null default 0,
  add column if not exists risk_flags    jsonb   not null default '[]'::jsonb,
  add column if not exists review_status text    not null default 'none'
    check (review_status in ('none', 'flagged', 'cleared')),
  add column if not exists flagged_at    timestamptz;

-- Fast lookup of the admin review queue (only flagged rows).
create index if not exists orders_review_flagged_idx
  on public.orders (flagged_at desc) where review_status = 'flagged';

commit;
