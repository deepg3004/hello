-- =============================================================================
-- Elementor-style website builder (Phase 1). Namespaced `builder_*` so it never
-- collides with the existing `pages` / `templates` tables. The editor layout is
-- stored as a JSON document tree (PAGE -> SECTIONS -> COLUMNS -> WIDGETS) in
-- builder_pages.content_json. All additive.
-- =============================================================================
begin;

-- ── Global template catalog (one-click apply). No owner — readable by all. ────
create table if not exists public.builder_templates (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  page_type         text not null default 'landing'
                      check (page_type in ('payment', 'landing', 'leads')),
  category          text not null default 'Business',
  preview_image_url text,
  page_json         jsonb not null default '{}'::jsonb,  -- { sections: [...] }
  header_json       jsonb,
  footer_json       jsonb,
  bottombar_json    jsonb,
  background_style  text not null default 'gradient',
  created_at        timestamptz not null default now()
);

-- ── A seller's site (one per seller for now; global header/footer + styles). ──
create table if not exists public.builder_sites (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.user_profiles(id) on delete cascade,
  slug               text not null unique,
  title              text not null default 'My site',
  global_styles_json jsonb not null default '{}'::jsonb,  -- colors, fonts
  header_json        jsonb,
  footer_json        jsonb,
  contacts_json      jsonb not null default '{}'::jsonb,   -- telegram/whatsapp/etc.
  is_published       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists builder_sites_user_idx on public.builder_sites(user_id);

-- ── Pages within a site (the editable document tree lives in content_json). ───
create table if not exists public.builder_pages (
  id               uuid primary key default gen_random_uuid(),
  site_id          uuid not null references public.builder_sites(id) on delete cascade,
  -- denormalised owner for simple RLS + scoping (kept in sync with the site).
  user_id          uuid not null references public.user_profiles(id) on delete cascade,
  name             text not null default 'Home',
  path             text not null default '',          -- '' = the site home
  page_type        text not null default 'landing'
                     check (page_type in ('payment', 'landing', 'leads')),
  content_json     jsonb not null default '{"sections":[]}'::jsonb,
  background_style text not null default 'gradient',
  bottombar_json   jsonb,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists builder_pages_site_idx on public.builder_pages(site_id);
create unique index if not exists builder_pages_site_path_uidx
  on public.builder_pages(site_id, path);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Sellers manage only their own site + pages. Templates are a public read-only
-- catalog. Public site rendering uses the service-role admin client (bypasses
-- RLS), same as the rest of the app.
alter table public.builder_templates enable row level security;
create policy "builder_templates_read" on public.builder_templates
  for select using (true);

alter table public.builder_sites enable row level security;
create policy "builder_sites_own" on public.builder_sites
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.builder_pages enable row level security;
create policy "builder_pages_own" on public.builder_pages
  using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
