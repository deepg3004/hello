-- =============================================================================
-- 017 — per-seller subdomain + custom domain
--
-- A seller now owns:
--   * one *.invoxai.io subdomain (rahul.invoxai.io)        — every seller can
--   * one custom domain (pages.rahul.com)                   — Pro+ plans
--
-- All of their published pages are reachable at both:
--   rahul.invoxai.io/my-course
--   pages.rahul.com/my-course
-- =============================================================================

begin;

alter table public.user_profiles
  -- 3-30 chars; lowercase letters, numbers, hyphens. Enforced here so RLS
  -- can't be tricked into accepting punycode or unicode.
  add column if not exists subdomain                    text
    check (
      subdomain is null
      or (
        char_length(subdomain) between 3 and 30
        and subdomain ~ '^[a-z][a-z0-9-]*[a-z0-9]$'
      )
    ),
  add column if not exists subdomain_cf_record_id       text,
  add column if not exists subdomain_claimed_at         timestamptz,

  add column if not exists custom_domain                text,
  add column if not exists custom_domain_verified_at    timestamptz,
  -- Lifecycle: 'pending' (seller added, awaiting DNS) → 'provisioning'
  -- (Cloudflare/Cert-Manager is fetching a cert) → 'active' (live)
  -- → 'failed' (verification or cert issuance broke).
  add column if not exists custom_domain_cert_status    text
    check (
      custom_domain_cert_status is null
      or custom_domain_cert_status in ('pending', 'provisioning', 'active', 'failed')
    ),
  add column if not exists custom_domain_last_checked_at timestamptz,
  add column if not exists custom_domain_last_error     text;

-- Globally unique so two sellers can't claim the same hostname.
create unique index if not exists user_profiles_subdomain_uidx
  on public.user_profiles (subdomain)
  where subdomain is not null;
create unique index if not exists user_profiles_custom_domain_uidx
  on public.user_profiles (custom_domain)
  where custom_domain is not null;

-- Reserved subdomains — we block claims at the action layer, but a table
-- here lets admins add new ones (e.g. "marketing") without a code deploy.
create table if not exists public.reserved_subdomains (
  name text primary key
);

insert into public.reserved_subdomains (name) values
  ('www'), ('hello'), ('api'), ('admin'), ('app'),
  ('mail'), ('static'), ('cdn'), ('blog'), ('docs'),
  ('status'), ('help'), ('support'), ('pay'), ('checkout'),
  ('billing'), ('login'), ('signup'), ('auth')
on conflict (name) do nothing;

commit;
