-- =============================================================================
-- 049 — Site pages (website builder)
-- Each seller can build a multi-page website on their subdomain. A site_page is
-- an ordered list of content blocks (same shape as pages.page_config.blocks).
-- One page per seller may be the home page (rendered at the subdomain root).
-- =============================================================================
begin;

create table if not exists public.site_pages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.user_profiles(id) on delete cascade,
  slug            text not null,
  title           text not null default 'Untitled',
  nav_label       text,
  is_home         boolean not null default false,
  show_in_nav     boolean not null default true,
  status          text not null default 'draft'
                    check (status in ('draft', 'published')),
  sort_order      int not null default 0,
  blocks          jsonb not null default '[]'::jsonb,
  seo_title       text,
  seo_description text,
  og_image        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Unique slug per seller; at most one home page per seller.
create unique index if not exists site_pages_user_slug_uidx
  on public.site_pages(user_id, slug);
create unique index if not exists site_pages_user_home_uidx
  on public.site_pages(user_id) where is_home;
create index if not exists site_pages_user_idx
  on public.site_pages(user_id, sort_order);

alter table public.site_pages enable row level security;

-- Sellers manage only their own pages. Public rendering uses the admin client
-- (service role) which bypasses RLS, so published pages render server-side.
create policy "site_pages_own" on public.site_pages
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

commit;
