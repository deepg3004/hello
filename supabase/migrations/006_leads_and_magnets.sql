-- =============================================================================
-- 006 — leads metadata + lead-magnets storage bucket
--
-- Adds:
--   lead_captures.tags / notes / confirmed_at / unsubscribed_at /
--   delivered_magnet
--   storage bucket "lead-magnets" (private)
--   storage RLS policies — owners can write, admin can read, signed-URL
--   reads bypass RLS so deliveries work
-- =============================================================================

begin;

-- ---- lead_captures additions ----------------------------------------------
alter table public.lead_captures
  add column if not exists tags             text[] default '{}',
  add column if not exists notes            jsonb  default '[]'::jsonb,
  add column if not exists confirmed_at     timestamptz,
  add column if not exists unsubscribed_at  timestamptz,
  add column if not exists delivered_magnet boolean default false;

create index if not exists lead_captures_email_idx on public.lead_captures(email);
create index if not exists lead_captures_tags_idx  on public.lead_captures using gin(tags);

-- ---- Storage bucket -------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lead-magnets',
  'lead-magnets',
  false,                                  -- private
  52428800,                               -- 50 MB
  array[
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'text/plain'
  ]
)
on conflict (id) do update
  set file_size_limit     = excluded.file_size_limit,
      allowed_mime_types  = excluded.allowed_mime_types;

-- Storage policies — paths are `{user_id}/{page_id}/{filename}` so the first
-- segment of the path identifies the owner.
drop policy if exists "lead_magnets_owner_upload" on storage.objects;
drop policy if exists "lead_magnets_owner_read"   on storage.objects;
drop policy if exists "lead_magnets_owner_delete" on storage.objects;
drop policy if exists "lead_magnets_admin_read"   on storage.objects;

create policy "lead_magnets_owner_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'lead-magnets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "lead_magnets_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'lead-magnets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "lead_magnets_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'lead-magnets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "lead_magnets_admin_read"
  on storage.objects for select
  using (bucket_id = 'lead-magnets' and public.is_admin());

-- Signed URLs already bypass RLS; no extra policy needed for buyer delivery.

commit;
