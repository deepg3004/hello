-- =============================================================================
-- 055 — seller custom SMTP (Session 14, Email Integrations)
--
-- One row per seller. When active, the seller's buyer-facing emails (order
-- receipt, lead confirmation, booking confirmation, contact) send from THEIR
-- SMTP/domain instead of the platform mailbox. Password encrypted via the vault.
-- Service-role only (RLS on, no policies).
-- =============================================================================

begin;

create table if not exists public.seller_smtp (
  user_id      uuid primary key references public.user_profiles(id) on delete cascade,
  host         text not null,
  port         integer not null default 587,
  secure       boolean not null default false,   -- true = implicit TLS (465)
  username     text not null,
  password_enc text not null,                     -- vault-encrypted
  from_name    text,
  from_email   text not null,
  reply_to     text,
  active       boolean not null default true,
  updated_at   timestamptz default now()
);

alter table public.seller_smtp enable row level security;

commit;
