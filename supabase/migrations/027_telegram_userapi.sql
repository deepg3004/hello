-- ===========================================================================
-- 027_telegram_userapi
--
-- Cosmofeed-style Telegram monetization via the MTProto User API (GramJS):
-- phone-OTP login, enumerate the user's channels, multi-tier subscription
-- plans, per-channel dashboards.
--
-- NOTE: the original spec numbered this 019, but 019_add_pages_published_at.sql
-- already exists — renumbered to 027 (next free slot) to avoid clobbering it.
-- ===========================================================================

begin;

-- Encrypted GramJS session per InvoxAI user (AES-256-GCM via INVOXAI_VAULT_KEY).
create table if not exists public.telegram_user_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.user_profiles(id)
                      on delete cascade,
  telegram_user_id  bigint not null,
  telegram_phone    text not null,
  telegram_username text,
  telegram_name     text,
  telegram_photo    text,
  session_string    text not null,
  connected_at      timestamptz default now(),
  last_used_at      timestamptz default now()
);
create index if not exists tus_user_id_idx
  on public.telegram_user_sessions(user_id);

alter table public.telegram_user_sessions enable row level security;
do $$ begin
  create policy "tus_owner_all" on public.telegram_user_sessions
    for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Extend telegram_vip_groups (most columns IF NOT EXISTS — several already exist).
alter table public.telegram_vip_groups
  add column if not exists telegram_chat_id       bigint,
  add column if not exists channel_type           text
    check (channel_type is null or channel_type in ('channel','supergroup','group')),
  add column if not exists channel_username       text,
  add column if not exists channel_photo_url      text,
  add column if not exists total_member_count     int default 0,
  add column if not exists description            text,
  add column if not exists category               text default 'General',
  add column if not exists page_name              text,
  add column if not exists page_description       text,
  add column if not exists logo_url               text,
  add column if not exists setup_complete         boolean default false,
  add column if not exists auto_page_id           uuid references public.pages(id),
  add column if not exists bot_username           text,
  add column if not exists auto_renewal_enabled   boolean default false,
  add column if not exists webhook_set_at         timestamptz,
  add column if not exists total_page_views       bigint default 0,
  add column if not exists registration_questions jsonb default '[]'::jsonb;

-- Multi-tier subscription plans per group.
create table if not exists public.telegram_subscription_plans (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.telegram_vip_groups(id)
                     on delete cascade,
  user_id          uuid not null references public.user_profiles(id)
                     on delete cascade,
  name             text not null,
  description      text,
  price            decimal(10,2) not null,
  original_price   decimal(10,2),
  duration_days    int not null,
  duration_label   text not null,
  is_popular       boolean default false,
  sort_order       int default 0,
  active           boolean default true,
  product_id       uuid references public.products(id) on delete set null,
  subscriber_count int default 0,
  created_at       timestamptz default now()
);
create index if not exists tsp_group_idx on public.telegram_subscription_plans(group_id);
create index if not exists tsp_user_idx  on public.telegram_subscription_plans(user_id);
alter table public.telegram_subscription_plans enable row level security;
do $$ begin
  create policy "tsp_owner_all" on public.telegram_subscription_plans
    for all using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Track which plan each membership used (+ reminder bookkeeping).
alter table public.telegram_memberships
  add column if not exists plan_id uuid
    references public.telegram_subscription_plans(id) on delete set null,
  add column if not exists plan_name text,
  add column if not exists reminder_3d_sent_at timestamptz,
  add column if not exists reminder_1d_sent_at timestamptz,
  add column if not exists bot_token_snapshot  text,
  add column if not exists group_chat_id       text;

-- Per-group page-view tracking.
create table if not exists public.telegram_group_views (
  id         bigserial primary key,
  group_id   uuid not null references public.telegram_vip_groups(id)
               on delete cascade,
  visitor_id text,
  ip_address inet,
  referrer   text,
  device     text check (device in ('mobile','desktop','tablet')),
  country    text,
  city       text,
  created_at timestamptz default now()
);
create index if not exists tgv_group_date_idx
  on public.telegram_group_views(group_id, created_at desc);
alter table public.telegram_group_views enable row level security;
do $$ begin
  create policy "tgv_owner_select" on public.telegram_group_views
    for select using (
      group_id in (select id from public.telegram_vip_groups where user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;

commit;
