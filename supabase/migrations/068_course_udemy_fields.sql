-- =============================================================================
-- 068 — Udemy-style course fields + free-preview lessons.
--
-- Adds the marketing/landing fields a Udemy course page needs (subtitle,
-- category, level, language, what-you'll-learn, requirements, who-it's-for,
-- instructor block, promo video) + a slug for clean /course/<slug> URLs, and a
-- per-lesson is_preview flag so some lessons are watchable before buying.
-- =============================================================================

begin;

alter table public.courses
  add column if not exists slug             text,
  add column if not exists subtitle         text,
  add column if not exists category         text,
  add column if not exists level            text,
  add column if not exists language         text not null default 'English',
  add column if not exists what_you_learn   jsonb not null default '[]'::jsonb,
  add column if not exists requirements     jsonb not null default '[]'::jsonb,
  add column if not exists who_for          jsonb not null default '[]'::jsonb,
  add column if not exists instructor_name  text,
  add column if not exists instructor_bio   text,
  add column if not exists instructor_avatar text,
  add column if not exists promo_video_url  text;

-- Clean per-seller slug. Backfill from title + a short id suffix for uniqueness.
update public.courses
   set slug = trim(both '-' from regexp_replace(lower(coalesce(title, 'course')), '[^a-z0-9]+', '-', 'g'))
              || '-' || substr(id::text, 1, 6)
 where slug is null;

create unique index if not exists courses_seller_slug_idx
  on public.courses(seller_user_id, slug) where slug is not null;

-- Free-preview lessons (watchable before purchase).
alter table public.course_lessons
  add column if not exists is_preview boolean not null default false;

commit;
