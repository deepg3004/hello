-- Lead-form submissions from builder pages. Additive; owner-scoped via user_id.
begin;

create table if not exists public.builder_leads (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references public.builder_sites(id) on delete cascade,
  user_id    uuid not null references public.user_profiles(id) on delete cascade,
  name       text,
  email      text,
  phone      text,
  message    text,
  created_at timestamptz not null default now()
);

create index if not exists builder_leads_user_idx on public.builder_leads(user_id, created_at desc);
create index if not exists builder_leads_site_idx on public.builder_leads(site_id);

alter table public.builder_leads enable row level security;
create policy "builder_leads_own" on public.builder_leads
  using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
