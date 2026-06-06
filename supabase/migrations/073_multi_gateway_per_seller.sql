-- =============================================================================
-- 073 — multiple payment gateways per seller
--
-- Until now seller_user_id was UNIQUE, so a seller could store only ONE gateway
-- and connecting a second overwrote the first (losing its keys). Switch the
-- uniqueness to (seller_user_id, gateway_type) so a seller can keep several
-- gateways connected at once and switch the ACTIVE one instantly. Exactly one
-- row per seller stays is_active=true (enforced in app logic); checkout reads
-- that active row.
-- =============================================================================

begin;

alter table public.seller_gateway_config
  drop constraint if exists seller_gateway_config_seller_user_id_key;

alter table public.seller_gateway_config
  add constraint seller_gateway_config_seller_gateway_uniq
  unique (seller_user_id, gateway_type);

commit;
