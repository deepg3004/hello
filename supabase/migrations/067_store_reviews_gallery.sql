-- =============================================================================
-- 067 — product image galleries + reviews/ratings (store + courses)
--
-- product_images: ordered gallery for a catalog product (Shopify-style). The
-- product's own image_url stays the primary/first image; these are extras.
--
-- reviews: generic star-rating + written review for a product OR a course
-- (subject_type/subject_id). One review per buyer email per subject. We only
-- accept a review from an email that actually purchased/enrolled (verified),
-- so ratings can't be spammed.
-- =============================================================================

begin;

create table if not exists public.product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url        text not null,
  alt        text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx
  on public.product_images(product_id);

create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  seller_user_id  uuid not null references public.user_profiles(id) on delete cascade,
  subject_type    text not null check (subject_type in ('product', 'course')),
  subject_id      uuid not null,
  order_id        uuid references public.orders(id) on delete set null,
  buyer_email     text not null,
  buyer_name      text,
  rating          integer not null check (rating between 1 and 5),
  title           text,
  body            text,
  verified        boolean not null default false,
  status          text not null default 'published' check (status in ('published', 'hidden')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (subject_type, subject_id, buyer_email)
);
create index if not exists reviews_subject_idx
  on public.reviews(subject_type, subject_id) where status = 'published';
create index if not exists reviews_seller_idx
  on public.reviews(seller_user_id);

alter table public.product_images enable row level security;
alter table public.reviews        enable row level security;

commit;
