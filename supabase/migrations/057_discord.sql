-- =============================================================================
-- 057 — Discord integration (Session 18)
--
-- Mirrors the Telegram VIP stack (telegram_vip_groups / telegram_memberships)
-- for Discord. A seller connects a bot + guild; paying buyers get a one-time
-- expiring invite (discord.gg) and a membership row whose lifecycle (reminders /
-- expiry / kick) is driven by the discord-expiries cron.
--
-- Fulfillment model v1 = INVITE LINK (parity with Telegram). The OAuth2 +
-- auto-join + role model layers on later WITHOUT a schema change:
--   * discord_servers.vip_role_id  — role to grant on join (unused in v1)
--   * discord_memberships.discord_user_id — populated by OAuth/manual; lets the
--     cron kick on expiry. Null in pure invite-link flow (the documented
--     weaker-enforcement tradeoff).
--
-- Service-role is the only writer (dashboard + routes use the admin client).
-- Owner RLS on discord_servers is defense-in-depth, matching the original
-- telegram tables; memberships are service-role only (RLS on, no policy).
-- =============================================================================

begin;

-- ── discord_servers: one connected guild per seller setup ───────────────────
create table if not exists public.discord_servers (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.user_profiles(id) on delete cascade,
  page_id               uuid,
  bot_token             text not null,
  bot_username          text,
  guild_id              text not null,            -- Discord snowflake
  guild_name            text,
  invite_channel_id     text,                     -- text channel invites are minted on
  vip_role_id           text,                     -- reserved for OAuth+role model (v2)
  access_duration_days  integer not null default 30,
  auto_renewal_enabled  boolean not null default true,
  active_members        integer not null default 0,
  setup_complete        boolean not null default true,
  created_at            timestamptz not null default now()
);

create index if not exists discord_servers_user_id_idx
  on public.discord_servers(user_id);

-- ── discord_memberships: one row per buyer access grant ─────────────────────
create table if not exists public.discord_memberships (
  id                  uuid primary key default gen_random_uuid(),
  discord_server_id   uuid not null references public.discord_servers(id) on delete cascade,
  order_id            uuid,
  discord_user_id     text,                       -- snowflake, null until known
  buyer_email         text,
  status              text not null default 'invited',  -- invited|active|expired|removed|banned
  invite_code         text,
  invite_link         text,
  invited_at          timestamptz,
  joined_at           timestamptz,
  expires_at          timestamptz,
  removed_at          timestamptz,
  bot_token_snapshot  text,
  guild_id            text,
  plan_id             uuid,
  reminder_3d_sent_at timestamptz,
  reminder_1d_sent_at timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists discord_memberships_server_id_idx
  on public.discord_memberships(discord_server_id);
create index if not exists discord_memberships_buyer_email_idx
  on public.discord_memberships(buyer_email);
create index if not exists discord_memberships_order_id_idx
  on public.discord_memberships(order_id);
create index if not exists discord_memberships_expires_at_idx
  on public.discord_memberships(expires_at);

-- ── link columns on existing tables ─────────────────────────────────────────
alter table public.pages
  add column if not exists discord_server_id uuid;
create index if not exists pages_discord_server_id_idx
  on public.pages(discord_server_id);

alter table public.orders
  add column if not exists discord_invite_link text;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.discord_servers enable row level security;
alter table public.discord_memberships enable row level security;

drop policy if exists "discord_servers owner" on public.discord_servers;
create policy "discord_servers owner" on public.discord_servers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

commit;
