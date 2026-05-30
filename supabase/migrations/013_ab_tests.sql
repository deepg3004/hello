-- =============================================================================
-- 013 — A/B testing on /p/[slug] pages
--
-- pages         — flags + variant_b_config + traffic_split + lifecycle
-- orders / lead_captures — exp_variant text so we can do downstream cohort
--                          analysis (and recompute counters from the DB if
--                          Redis is wiped)
-- page_experiments — history list shown at the bottom of the A/B page; we
--                    snapshot the final counts at promote / stop time so the
--                    seller can compare back later.
-- =============================================================================

begin;

alter table public.pages
  add column if not exists experiment_status      text default 'idle'
    check (experiment_status in ('idle', 'running', 'completed', 'archived')),
  add column if not exists variant_b_config       jsonb,
  add column if not exists traffic_split          decimal(5, 2) default 50
    check (traffic_split is null or (traffic_split >= 10 and traffic_split <= 90)),
  add column if not exists success_metric         text
    check (success_metric is null or success_metric in ('payment_conversion', 'form_submission')),
  add column if not exists experiment_started_at  timestamptz,
  add column if not exists experiment_ended_at    timestamptz;

alter table public.orders
  add column if not exists exp_variant text check (exp_variant is null or exp_variant in ('A', 'B'));

alter table public.lead_captures
  add column if not exists exp_variant text check (exp_variant is null or exp_variant in ('A', 'B'));

create index if not exists orders_page_exp_variant_idx
  on public.orders(page_id, exp_variant) where exp_variant is not null;
create index if not exists lead_captures_page_exp_variant_idx
  on public.lead_captures(page_id, exp_variant) where exp_variant is not null;

-- ── Experiment history ────────────────────────────────────────────────────
create table if not exists public.page_experiments (
  id                 uuid primary key default gen_random_uuid(),
  page_id            uuid not null references public.pages(id) on delete cascade,
  seller_user_id     uuid references public.user_profiles(id) on delete set null,
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  success_metric     text not null,
  traffic_split      decimal(5, 2) not null,
  variant_a_config   jsonb,
  variant_b_config   jsonb,
  visitors_a         integer default 0,
  visitors_b         integer default 0,
  conversions_a      integer default 0,
  conversions_b      integer default 0,
  revenue_a          decimal(12, 2) default 0,
  revenue_b          decimal(12, 2) default 0,
  confidence         decimal(5, 4),
  winner             text check (winner is null or winner in ('A', 'B', 'inconclusive')),
  outcome            text not null default 'stopped'
    check (outcome in ('promoted', 'stopped', 'archived')),
  notes              text,
  created_at         timestamptz default now()
);

create index if not exists page_experiments_page_id_idx
  on public.page_experiments(page_id, started_at desc);

alter table public.page_experiments enable row level security;
drop policy if exists "Sellers read own experiments" on public.page_experiments;
create policy "Sellers read own experiments"
  on public.page_experiments for select
  using (
    seller_user_id = auth.uid()
    or coalesce((select is_admin from public.user_profiles where id = auth.uid()), false)
  );

commit;
