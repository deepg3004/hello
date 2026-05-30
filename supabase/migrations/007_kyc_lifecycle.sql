-- =============================================================================
-- 007 — KYC verification lifecycle
--
-- Adds:
--   kyc_submissions extras    (returned bank holder name, aadhaar, gst,
--                              business reg, attempts counters)
--   kyc_verification_logs     (audit of every Surepass call — payloads
--                              redacted to non-PII bits)
--   kyc-documents storage     (private bucket — selfies, ID docs, GST cert)
-- =============================================================================

begin;

-- ---- kyc_submissions extras -----------------------------------------------
alter table public.kyc_submissions
  add column if not exists bank_holder_name_returned text,
  add column if not exists bank_account_number      text,
  add column if not exists bank_ifsc                text,
  add column if not exists aadhaar_last4            text,
  add column if not exists aadhaar_verified_at      timestamptz,
  add column if not exists aadhaar_ref_id           text,
  add column if not exists gst_certificate_url      text,
  add column if not exists business_registration_url text,
  add column if not exists pan_attempts             integer default 0,
  add column if not exists bank_attempts            integer default 0;

-- ---- kyc_verification_logs ------------------------------------------------
create table if not exists public.kyc_verification_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.user_profiles(id) on delete cascade,
  submission_id    uuid references public.kyc_submissions(id) on delete set null,
  kind             text not null
    check (kind in ('pan', 'bank', 'aadhaar_otp', 'aadhaar_verify', 'document', 'gst', 'business_reg')),
  provider         text not null default 'surepass',
  request_summary  jsonb,
  response_summary jsonb,
  success          boolean not null default false,
  error_message    text,
  http_status      integer,
  duration_ms      integer,
  created_at       timestamptz default now()
);

create index if not exists kyc_verification_logs_user_id_idx on public.kyc_verification_logs(user_id);
create index if not exists kyc_verification_logs_kind_idx     on public.kyc_verification_logs(kind);

alter table public.kyc_verification_logs enable row level security;

create policy "kyc_logs_owner_select"
  on public.kyc_verification_logs for select
  using (auth.uid() = user_id or public.is_admin());

-- Writes happen via service role; no client policy.

-- ---- Storage bucket -------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-documents',
  'kyc-documents',
  false,                                  -- private
  20971520,                               -- 20 MB
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies — paths are `{user_id}/{document_type}/{filename}`.
drop policy if exists "kyc_owner_upload" on storage.objects;
drop policy if exists "kyc_owner_read"   on storage.objects;
drop policy if exists "kyc_admin_read"   on storage.objects;

create policy "kyc_owner_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'kyc-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "kyc_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'kyc-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "kyc_admin_read"
  on storage.objects for select
  using (bucket_id = 'kyc-documents' and public.is_admin());

-- Signed URLs already bypass RLS — no additional policy needed.

commit;
