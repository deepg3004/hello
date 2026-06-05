-- =============================================================================
-- 059 — gap-fill columns (pack residual items)
--
--   seller_smtp.sending_domain   — S14 setSendingDomainAction (the verified
--                                  domain a seller sends from; informational +
--                                  used in the connect UI).
--   discord_servers.app_public_key — S18 Discord interactions endpoint: the
--                                  bot application's Ed25519 public key, used to
--                                  verify Discord's signed interaction requests
--                                  (PING/PONG endpoint verification).
-- Both additive + nullable. Service-role only (existing RLS unchanged).
-- =============================================================================

begin;

alter table public.seller_smtp
  add column if not exists sending_domain text;

alter table public.discord_servers
  add column if not exists app_public_key text;

commit;
