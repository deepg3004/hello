-- =============================================================================
-- 014 — pixel manager extensions
--
-- pixel_configs gets:
--   - meta_capi_access_token  (Meta Conversions API)
--   - fire_* toggles per platform
--   - clarity_id              (Microsoft Clarity)
--   - custom_script           (Pro+ plan only — admin can disable globally)
--
-- system_settings (from 004) gets a row so admins can switch off the
-- custom-script feature platform-wide without touching code.
-- =============================================================================

begin;

alter table public.pixel_configs
  add column if not exists meta_capi_access_token  text,
  add column if not exists meta_fire_purchase      boolean default true,
  add column if not exists meta_fire_lead          boolean default true,
  add column if not exists google_fire_conversion  boolean default true,
  add column if not exists clarity_id              text,
  add column if not exists custom_script           text;

-- Default off — admin flips this on when the platform is comfortable
-- with letting Pro+ sellers paste arbitrary JS into their pages.
insert into public.system_settings (key, value, description)
values (
  'allow_custom_scripts',
  to_jsonb(true),
  'Master switch — when true, Pro+ sellers can paste a custom <script> block into the Pixels tab.'
)
on conflict (key) do nothing;

commit;
