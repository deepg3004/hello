-- =============================================================================
-- 065 — HLS (AES-128) video assets (Session 9, zero-cost DRM-ish)
--
-- When a seller uploads a course video, a background job transcodes it to
-- AES-128-encrypted HLS (system ffmpeg) and records the result here, keyed by
-- the raw upload's storage path. The player prefers the encrypted HLS stream
-- (segments useless without the key, which is served only to authorized
-- viewers) and falls back to the raw signed URL while still processing.
--
-- The AES key is stored ENCRYPTED (lib/gateway-crypto, GATEWAY_ENCRYPTION_KEY).
-- Service-role only (RLS on, no policies).
-- =============================================================================

begin;

create table if not exists public.hls_assets (
  id         uuid primary key default gen_random_uuid(),
  raw_path   text not null unique,    -- course-media path of the raw upload (no cmedia: prefix)
  hls_dir    text,                    -- course-media dir holding out.m3u8 + seg_*.ts
  key_enc    text,                    -- AES-128 key, encrypted
  iv         text,                    -- hex IV
  seg_count  integer,
  status     text not null default 'processing'
    check (status in ('processing', 'ready', 'failed')),
  error      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hls_assets enable row level security;

commit;
