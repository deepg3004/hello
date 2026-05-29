-- =============================================================================
-- 004 — admin features
--
-- Adds:
--   pages.flagged_*                 (admin can flag pages for review)
--   user_profiles.suspended_*       (admin can suspend a seller account)
--   public.platform_settings        (runtime KV — commission %, vault entries)
--   public.admin_notes              (free-form admin notes attached to a user)
--   public.support_tickets          (basic ticket queue — Gmail wiring later)
--   public.support_messages         (per-ticket message history)
-- =============================================================================

begin;

-- ---- pages: flagging --------------------------------------------------------
alter table public.pages
  add column if not exists flagged_at timestamptz,
  add column if not exists flag_reason text,
  add column if not exists flagged_by_admin_id uuid references public.user_profiles(id);

create index if not exists pages_flagged_at_idx on public.pages(flagged_at);

-- ---- user_profiles: suspension ---------------------------------------------
alter table public.user_profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists suspended_by_admin_id uuid references public.user_profiles(id);

-- ---- platform_settings -----------------------------------------------------
create table if not exists public.platform_settings (
  key          text primary key,
  value        text not null,
  encrypted    boolean default false,
  description  text,
  updated_at   timestamptz default now(),
  updated_by   uuid references public.user_profiles(id)
);

alter table public.platform_settings enable row level security;

create policy "platform_settings_admin_read"
  on public.platform_settings for select
  using (public.is_admin());

-- writes go through the service role from server actions; no client policy.

-- Seed a couple of defaults (idempotent).
insert into public.platform_settings (key, value, description)
values
  ('platform_commission_percent', '5', 'Default platform commission % deducted from every paid order.'),
  ('min_payout_amount', '500', 'Minimum INR a seller can withdraw in a single payout.')
on conflict (key) do nothing;

-- ---- admin_notes -----------------------------------------------------------
create table if not exists public.admin_notes (
  id              uuid primary key default gen_random_uuid(),
  target_user_id  uuid not null references public.user_profiles(id) on delete cascade,
  admin_id        uuid not null references public.user_profiles(id),
  body            text not null,
  created_at      timestamptz default now()
);

create index if not exists admin_notes_target_user_id_idx on public.admin_notes(target_user_id);

alter table public.admin_notes enable row level security;

create policy "admin_notes_admin_read"
  on public.admin_notes for select
  using (public.is_admin());

-- ---- support_tickets / messages -------------------------------------------
create table if not exists public.support_tickets (
  id                uuid primary key default gen_random_uuid(),
  subject           text not null,
  from_email        text not null,
  from_name         text,
  user_id           uuid references public.user_profiles(id) on delete set null,
  gmail_thread_id   text unique,
  status            text default 'open'
    check (status in ('open', 'in_progress', 'resolved')),
  last_message_at   timestamptz default now(),
  created_at        timestamptz default now(),
  resolved_at       timestamptz,
  assigned_admin_id uuid references public.user_profiles(id)
);

create index if not exists support_tickets_status_idx on public.support_tickets(status);
create index if not exists support_tickets_user_id_idx on public.support_tickets(user_id);

alter table public.support_tickets enable row level security;

create policy "support_tickets_admin_all"
  on public.support_tickets for all
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.support_messages (
  id                uuid primary key default gen_random_uuid(),
  ticket_id         uuid not null references public.support_tickets(id) on delete cascade,
  direction         text check (direction in ('inbound', 'outbound')),
  from_email        text,
  body              text not null,
  gmail_message_id  text unique,
  sent_by_admin_id  uuid references public.user_profiles(id),
  created_at        timestamptz default now()
);

create index if not exists support_messages_ticket_id_idx on public.support_messages(ticket_id);

alter table public.support_messages enable row level security;

create policy "support_messages_admin_all"
  on public.support_messages for all
  using (public.is_admin())
  with check (public.is_admin());

commit;
