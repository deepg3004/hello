-- =============================================================================
-- 089 — per-page SEO for the website builder
--
-- builder_pages rendered at /u/<slug>/<path> previously had no SEO surface — the
-- public page only ever used the site title. This adds per-page SEO fields the
-- editor writes and generateMetadata reads (title, description, OG image, and a
-- noindex toggle for thank-you / unlisted pages). All additive + nullable.
-- =============================================================================

begin;

alter table public.builder_pages
  add column if not exists seo_title       text,
  add column if not exists seo_description text,
  add column if not exists og_image        text,
  add column if not exists noindex         boolean not null default false;

commit;
