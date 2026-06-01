-- =============================================================================
-- 034 — Creator Academy ("Learn") page: admin-managed video library + content.
--
--   learn_videos        — featured masterclass + the two carousels
--   platform_settings   — hero + resources-card copy (reuses existing kv table)
--   learn-media bucket   — uploaded MP4s / thumbnails / hero image
--
-- Sellers read published rows; all writes go through the service-role client
-- (admin actions), so no INSERT/UPDATE policy is exposed.
-- =============================================================================

begin;

create table if not exists public.learn_videos (
  id             uuid primary key default gen_random_uuid(),
  section        text not null check (section in ('featured', 'use_invoxai', 'niche')),
  title          text not null,
  description    text,
  video_url      text,
  thumbnail_url  text,
  duration_label text,
  badge_label    text,
  cta_label      text,
  sort_order     integer not null default 0,
  is_published   boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists learn_videos_section_order_idx
  on public.learn_videos (section, sort_order);

alter table public.learn_videos enable row level security;

-- Any signed-in user can read published content.
drop policy if exists "learn_videos_select_published" on public.learn_videos;
create policy "learn_videos_select_published" on public.learn_videos
  for select using (is_published = true);

-- Public bucket for uploaded videos / thumbnails / hero image (100 MB cap).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('learn-media', 'learn-media', true, 104857600,
        array['image/png','image/jpeg','image/webp','image/gif',
              'video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Default hero + resources copy (no-op if already set) ────────────────────
insert into public.platform_settings (key, value, encrypted) values
  ('learn_hero_label', 'Creator Academy', false),
  ('learn_hero_heading', 'Learn how to grow and sell with invoxai', false),
  ('learn_hero_image_url', '', false),
  ('learn_resources_title', 'Resources for Creators', false),
  ('learn_resources_bullets', E'Viral Hooks\nGrowth Guides\nChatGPT Prompts & more!', false),
  ('learn_resources_cta_label', 'Access Resources', false),
  ('learn_resources_cta_url', '', false)
on conflict (key) do nothing;

-- ── Seed the video library once (only when the table is empty) ──────────────
do $$
begin
  if not exists (select 1 from public.learn_videos) then
    insert into public.learn_videos
      (section, title, description, duration_label, badge_label, cta_label, sort_order)
    values
      ('featured', 'Online Money Making Model - Full Masterclass',
       'A complete walk-through of the online money-making model.',
       '56 mins', 'NOW AVAILABLE', 'Start watching', 0);

    insert into public.learn_videos (section, title, description, sort_order) values
      ('use_invoxai', 'Getting started with invoxai', 'Learn how to set up Store, AutoDM, and Digital Products to start selling.', 0),
      ('use_invoxai', 'How to Sell Digital Products on invoxai', 'Learn how to create and sell digital products with ease', 1),
      ('use_invoxai', 'How to Set Up Your Online Store with invoxai', 'A complete guide to setting up your online store', 2),
      ('use_invoxai', 'How to Create Online Courses with invoxai', 'Step-by-step guide to creating and selling courses', 3),
      ('use_invoxai', 'How to Capture Leads with Lead Magnets', 'Grow your audience with effective lead magnets', 4),
      ('use_invoxai', 'How to Set Up 1:1 Bookings with invoxai', 'Manage your appointments and consultations easily', 5),
      ('use_invoxai', 'How to Connect Your Email Platforms to invoxai', 'Integrate your favorite email marketing tools', 6),
      ('use_invoxai', 'How to Use invoxai Links for Smarter Sharing', 'Create smart links to boost your content reach', 7),
      ('use_invoxai', 'How to Automate Your Instagram DMs with AutoDM', 'Set up automated DM responses for your audience', 8),
      ('use_invoxai', 'How to Manage Leads with the Audience Tab', 'Track and manage your leads effectively', 9);

    insert into public.learn_videos (section, title, description, sort_order) values
      ('niche', 'How to earn and multiply your earnings as a Travel Creator',
       E'Learn how travel creators can turn content into consistent income. In this video, I''ll break down simple ways to monetize your audience and scale your earnings over time.', 0),
      ('niche', 'How to create a new online income stream as Doctors',
       'Discover how doctors can build an additional income stream online. This video covers simple monetization ideas using your knowledge and experience.', 1),
      ('niche', 'Making money online with your passion for fitness',
       E'Learn how to make money online with your passion for fitness. In this video, I''ll cover practical ways to monetize your audience and grow your income.', 2);
  end if;
end $$;

commit;
