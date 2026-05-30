-- =============================================================================
-- 019 — add pages.published_at
--
-- Why:
--   actions/pages.ts (createPageAction, updatePageAction) and
--   actions/admin.ts (publishPageAction) all write to pages.published_at,
--   but no migration ever created the column. Result: every "Publish" click
--   threw "Could not find the 'published_at' column of 'pages' in the
--   schema cache" from PostgREST.
--
--   types/index.ts already declares published_at on Page — this brings the
--   schema in line with the type contract.
-- =============================================================================

begin;

alter table public.pages
  add column if not exists published_at timestamptz;

-- Backfill: rows already in status='published' get updated_at as the best
-- approximation. Safe to re-run.
update public.pages
   set published_at = updated_at
 where status = 'published' and published_at is null;

create index if not exists pages_published_at_idx
  on public.pages(published_at) where published_at is not null;

notify pgrst, 'reload schema';

commit;
