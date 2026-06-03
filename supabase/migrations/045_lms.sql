-- =============================================================================
-- 045 — LMS (sellers sell courses to buyers)
--
-- courses → course_modules → course_lessons (video + text). A course links to a
-- product; buying that product creates a course_enrollment. Buyers access via a
-- signed link (no account) and progress is tracked per enrollment/lesson.
--
-- RLS: seller-own SELECT on the authoring tables; enrollments/progress have NO
-- client policies — student access is server-side + token-gated (service role).
-- =============================================================================

begin;

create table if not exists public.courses (
  id              uuid primary key default gen_random_uuid(),
  seller_user_id  uuid not null references public.user_profiles(id) on delete cascade,
  product_id      uuid unique references public.products(id) on delete set null,
  title           text not null,
  description     text,
  thumbnail_url   text,
  status          text not null default 'draft' check (status in ('draft', 'published')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists courses_seller_idx on public.courses(seller_user_id);
create index if not exists courses_product_idx on public.courses(product_id) where product_id is not null;

create table if not exists public.course_modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  title       text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists course_modules_course_idx on public.course_modules(course_id, sort_order);

create table if not exists public.course_lessons (
  id              uuid primary key default gen_random_uuid(),
  module_id       uuid not null references public.course_modules(id) on delete cascade,
  title           text not null,
  video_url       text,
  content         text,
  duration_label  text,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists course_lessons_module_idx on public.course_lessons(module_id, sort_order);

create table if not exists public.course_enrollments (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references public.courses(id) on delete cascade,
  order_id    uuid references public.orders(id) on delete set null,
  buyer_email text not null,
  created_at  timestamptz not null default now(),
  unique (course_id, order_id)
);
create index if not exists course_enrollments_course_idx on public.course_enrollments(course_id);
create index if not exists course_enrollments_email_idx on public.course_enrollments(buyer_email);

create table if not exists public.lesson_progress (
  id             uuid primary key default gen_random_uuid(),
  enrollment_id  uuid not null references public.course_enrollments(id) on delete cascade,
  lesson_id      uuid not null references public.course_lessons(id) on delete cascade,
  completed_at   timestamptz not null default now(),
  unique (enrollment_id, lesson_id)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.courses             enable row level security;
alter table public.course_modules      enable row level security;
alter table public.course_lessons      enable row level security;
alter table public.course_enrollments  enable row level security;
alter table public.lesson_progress     enable row level security;

-- Sellers can read their own courses (authoring writes go through the service
-- role with explicit ownership checks in actions/courses.ts).
create policy "courses_own" on public.courses
  for select using (seller_user_id = auth.uid());

create policy "course_modules_own" on public.course_modules
  for select using (exists (
    select 1 from public.courses c
    where c.id = course_modules.course_id and c.seller_user_id = auth.uid()
  ));

create policy "course_lessons_own" on public.course_lessons
  for select using (exists (
    select 1
    from public.course_modules m
    join public.courses c on c.id = m.course_id
    where m.id = course_lessons.module_id and c.seller_user_id = auth.uid()
  ));

-- course_enrollments + lesson_progress: no client policies (service role only).

commit;
