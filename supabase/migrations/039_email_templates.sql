-- =============================================================================
-- 039 — Admin-editable email templates (CMS override layer).
--
-- Built-in templates keep their code and run as-is UNTIL an admin saves an
-- override row here (key = the template key). Custom templates live only here
-- (is_custom = true). The renderer (lib/emails/render.ts) checks this table
-- first, else falls back to the code template.
--
-- No seed — built-in rows are created on first edit; customs via the admin UI.
-- =============================================================================

begin;

create table if not exists public.email_templates (
  key         text primary key,
  name        text not null default '',
  audience    text not null default 'Other',
  role        text not null default 'noreply',
  subject     text not null default '',
  body_html   text not null default '',
  use_shell   boolean not null default true,
  is_custom   boolean not null default false,
  enabled     boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

commit;
