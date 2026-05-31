-- =============================================================================
-- 024 — Security hardening
--
-- Audit findings addressed:
--   * Block self-promotion to admin via user_profiles UPDATE (CRITICAL)
--   * CHECK constraints on money columns so a negative price / discount
--     can't sneak past the API into the ledger (HIGH)
--   * RLS on reserved_subdomains so the table follows the
--     "RLS everywhere" rule (MEDIUM)
--   * Composite index on payouts (user_id, status) for the dashboard
--     queries that pull "my pending payouts" (LOW)
--   * New `oto_token_consumed` table so an OTO HMAC cookie can only be
--     redeemed once — defeats the replay-cookie upsell duplication
--     issue (CRITICAL)
--   * New `webhook_secret_token` column on telegram_vip_groups so the
--     Telegram webhook can verify the X-Telegram-Bot-Api-Secret-Token
--     header that Telegram echoes back — defeats unauthenticated
--     join/leave event forgery (HIGH)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. user_profiles: prevent self-promote to admin via a BEFORE UPDATE trigger.
--    Service role bypasses RLS but NOT triggers — we still want the admin
--    panel server actions (which run on the service role) to be able to
--    flip the flag, so we treat `auth.uid() IS NULL` as the service-role
--    case and allow it through. Non-service callers must already be admin.
-- ---------------------------------------------------------------------------
create or replace function public.user_profiles_block_self_promote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_is_admin boolean;
begin
  -- No change to is_admin? nothing to enforce.
  if new.is_admin is not distinct from old.is_admin then
    return new;
  end if;

  -- Service-role / privileged backend (no JWT sub) is allowed.
  if current_user_id is null then
    return new;
  end if;

  select coalesce(is_admin, false)
    into current_user_is_admin
    from public.user_profiles
    where id = current_user_id;

  if not coalesce(current_user_is_admin, false) then
    raise exception
      'Only existing admins may change user_profiles.is_admin (attempted by %)',
      current_user_id
    using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists user_profiles_block_self_promote on public.user_profiles;
create trigger user_profiles_block_self_promote
  before update of is_admin on public.user_profiles
  for each row execute function public.user_profiles_block_self_promote();

-- ---------------------------------------------------------------------------
-- 2. Money-column CHECK constraints. We add them NOT VALID first to avoid
--    failing if a stray bad row exists, then VALIDATE in a second pass —
--    that pattern is safe to rerun and reports the offending rows in
--    `pg_constraint` if validation does fail.
-- ---------------------------------------------------------------------------
alter table public.products
  drop constraint if exists products_price_nonnegative;
alter table public.products
  add constraint products_price_nonnegative
  check (price >= 0) not valid;
alter table public.products
  validate constraint products_price_nonnegative;

alter table public.orders
  drop constraint if exists orders_amount_positive;
alter table public.orders
  add constraint orders_amount_positive
  check (amount >= 0) not valid;
alter table public.orders
  validate constraint orders_amount_positive;

alter table public.orders
  drop constraint if exists orders_commission_nonnegative;
alter table public.orders
  add constraint orders_commission_nonnegative
  check (platform_commission >= 0) not valid;
alter table public.orders
  validate constraint orders_commission_nonnegative;

alter table public.orders
  drop constraint if exists orders_seller_amount_nonnegative;
alter table public.orders
  add constraint orders_seller_amount_nonnegative
  check (seller_amount >= 0) not valid;
alter table public.orders
  validate constraint orders_seller_amount_nonnegative;

alter table public.coupons
  drop constraint if exists coupons_discount_value_nonnegative;
alter table public.coupons
  add constraint coupons_discount_value_nonnegative
  check (discount_value >= 0) not valid;
alter table public.coupons
  validate constraint coupons_discount_value_nonnegative;

-- ---------------------------------------------------------------------------
-- 3. RLS on reserved_subdomains (public-read but RLS on for consistency).
-- ---------------------------------------------------------------------------
alter table public.reserved_subdomains enable row level security;

drop policy if exists "reserved_subdomains_public_read" on public.reserved_subdomains;
create policy "reserved_subdomains_public_read"
  on public.reserved_subdomains for select
  using (true);

-- ---------------------------------------------------------------------------
-- 4. Composite index for the seller dashboard's "my pending/processing
--    payouts" query (saves a seq scan once payouts grows past ~10k rows).
-- ---------------------------------------------------------------------------
create index if not exists payouts_user_status_idx
  on public.payouts(user_id, status);

-- ---------------------------------------------------------------------------
-- 5. OTO single-use ledger. We store the jti (random nonce minted with the
--    HMAC token) and the order it minted, so the second redemption attempt
--    fails on the primary-key conflict.
-- ---------------------------------------------------------------------------
create table if not exists public.oto_token_consumed (
  jti              text primary key,
  parent_order_id  uuid not null references public.orders(id) on delete cascade,
  consumed_at      timestamptz not null default now()
);

create index if not exists oto_token_consumed_parent_idx
  on public.oto_token_consumed(parent_order_id);

alter table public.oto_token_consumed enable row level security;
-- Service-role only — never read or written from the client.

-- ---------------------------------------------------------------------------
-- 6. Telegram webhook secret token per group. Telegram echoes whatever we
--    pass to `setWebhook?secret_token=...` in the
--    `X-Telegram-Bot-Api-Secret-Token` header on every callback. We
--    generate it when the seller wires up the bot and verify it on every
--    POST to /api/webhooks/telegram/[group_id].
-- ---------------------------------------------------------------------------
alter table public.telegram_vip_groups
  add column if not exists webhook_secret_token text;
