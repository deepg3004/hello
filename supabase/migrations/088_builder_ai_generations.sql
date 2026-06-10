-- =============================================================================
-- 088 — AI website generation log
--
-- One row per AI page generation (Phase 9). Powers the per-seller monthly usage
-- limit (counted from this table) and gives admins visibility into prompts,
-- outputs, token spend, and failures. Service-role only; RLS on so a seller can
-- read their own rows but never anyone else's.
-- =============================================================================

begin;

create table if not exists public.builder_ai_generations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.user_profiles(id) on delete cascade,
  brief_json    jsonb not null default '{}'::jsonb,
  output_json   jsonb,                      -- the validated AiSite (null on failure)
  page_id       uuid references public.builder_pages(id) on delete set null,
  status        text not null default 'success'
                  check (status in ('success', 'failed')),
  error         text,
  model         text,
  input_tokens  integer,
  output_tokens integer,
  created_at    timestamptz not null default now()
);

create index if not exists builder_ai_generations_user_idx
  on public.builder_ai_generations(user_id, created_at desc);

alter table public.builder_ai_generations enable row level security;

create policy "builder_ai_generations_own"
  on public.builder_ai_generations
  for select
  using (user_id = auth.uid());

commit;
