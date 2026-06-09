-- Email sequences / drip automation. A seller builds a sequence (ordered steps
-- with a delay + subject + body) that triggers on an event (lead captured /
-- purchase); contacts get enrolled and the scheduler cron sends each step when
-- due. Additive; owner-scoped RLS.
begin;

create table if not exists public.email_sequences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.user_profiles(id) on delete cascade,
  name        text not null default 'Untitled sequence',
  -- which event enrolls a contact: lead_created | purchase | manual
  trigger     text not null default 'lead_created'
                check (trigger in ('lead_created', 'purchase', 'manual')),
  active      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists email_sequences_user_idx on public.email_sequences(user_id);
create index if not exists email_sequences_trigger_idx
  on public.email_sequences(trigger, active) where active = true;

create table if not exists public.email_sequence_steps (
  id            uuid primary key default gen_random_uuid(),
  sequence_id   uuid not null references public.email_sequences(id) on delete cascade,
  step_order    int not null default 0,
  -- hours to wait AFTER the previous step (or after enrollment for step 0).
  delay_hours   int not null default 24,
  subject       text not null default '',
  body          text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists email_sequence_steps_seq_idx
  on public.email_sequence_steps(sequence_id, step_order);

create table if not exists public.sequence_enrollments (
  id            uuid primary key default gen_random_uuid(),
  sequence_id   uuid not null references public.email_sequences(id) on delete cascade,
  user_id       uuid not null references public.user_profiles(id) on delete cascade,
  contact_email text not null,
  contact_name  text,
  current_step  int not null default 0,        -- next step index to send
  status        text not null default 'active' -- active | done | stopped
                  check (status in ('active', 'done', 'stopped')),
  next_send_at  timestamptz,
  enrolled_at   timestamptz not null default now(),
  unique (sequence_id, contact_email)
);
create index if not exists sequence_enrollments_due_idx
  on public.sequence_enrollments(next_send_at) where status = 'active';
create index if not exists sequence_enrollments_user_idx on public.sequence_enrollments(user_id);

-- RLS — sellers manage their own. The scheduler + enrollment use the service
-- role (bypasses RLS).
alter table public.email_sequences enable row level security;
create policy "email_sequences_own" on public.email_sequences
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.email_sequence_steps enable row level security;
create policy "email_sequence_steps_own" on public.email_sequence_steps
  using (exists (select 1 from public.email_sequences s where s.id = sequence_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.email_sequences s where s.id = sequence_id and s.user_id = auth.uid()));

alter table public.sequence_enrollments enable row level security;
create policy "sequence_enrollments_own" on public.sequence_enrollments
  using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
