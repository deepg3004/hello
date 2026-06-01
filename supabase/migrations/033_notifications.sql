-- =============================================================================
-- 033 — in-app notification feed (the bell) for sellers AND admins
--
-- One row per recipient. Seller-facing events target the seller's user_id;
-- platform-wide events fan out to one row per admin (user_profiles.is_admin).
-- Inserts happen via the service-role client (bypasses RLS); recipients read
-- and mark-read only their own rows under RLS. The table is added to the
-- supabase_realtime publication so the bell updates live (with polling as a
-- belt-and-braces fallback in the client).
-- =============================================================================

begin;

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  meta        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Newest-first feed per recipient.
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
-- Fast unread-count (partial index — only unread rows).
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

-- Recipients can read their own notifications.
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

-- Recipients can mark their own notifications read (and nothing else — the
-- WITH CHECK keeps the row owned by them).
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- No INSERT/DELETE policy on purpose: writes are service-role only.

-- Live bell updates. Guarded so re-running the migration is a no-op.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename  = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

commit;
