-- =============================================================================
-- 091 — builder page version history
--
-- Every save of a builder page snapshots its document here so a seller can roll
-- back a bad edit ("undo a publish"). Capped to the latest ~20 per page by the
-- save handler. Best-effort: a failed snapshot never blocks the save.
-- Service-role writes; sellers read only their own versions (RLS).
-- =============================================================================

begin;

create table if not exists public.builder_page_versions (
  id            uuid primary key default gen_random_uuid(),
  page_id       uuid not null references public.builder_pages(id) on delete cascade,
  user_id       uuid not null references public.user_profiles(id) on delete cascade,
  content_json  jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists builder_page_versions_page_idx
  on public.builder_page_versions(page_id, created_at desc);

alter table public.builder_page_versions enable row level security;

create policy "builder_page_versions_own"
  on public.builder_page_versions
  for select
  using (user_id = auth.uid());

commit;
