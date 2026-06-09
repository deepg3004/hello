-- Per-seller Cashfree sandbox flag, so a seller's sandbox keys hit the sandbox
-- API base and live keys hit production — no more flipping a global env var.
-- Additive; default false (= production, matching prior behaviour).
begin;

alter table public.seller_gateway_config
  add column if not exists is_sandbox boolean not null default false;

commit;
