-- =============================================================================
-- 040 — Seller wallet system
--
-- Sellers maintain a prepaid wallet. InvoxAI deducts a per-order platform fee
-- on every completed order (see app/api/checkout/verify-payment). This creates:
--   1. seller_wallets        — current balance per seller
--   2. wallet_transactions   — full audit log of every credit / debit
--   3. deduct_wallet_balance()  — atomic debit RPC (mirrors increment_page_revenue, 018)
--   4. credit_wallet_balance()  — atomic credit RPC (recharges)
--
-- Money is stored in PAISE (bigint) — no floating point, no rounding drift.
-- =============================================================================

begin;

-- ── 1. seller_wallets ───────────────────────────────────────────────────────
create table if not exists public.seller_wallets (
  id                             uuid primary key default gen_random_uuid(),
  seller_user_id                 uuid unique not null
                                   references public.user_profiles(id) on delete cascade,
  balance_paise                  bigint not null default 0
                                   check (balance_paise >= 0),
  auto_recharge_enabled          boolean not null default false,
  auto_recharge_threshold_paise  bigint not null default 20000,  -- ₹200
  auto_recharge_amount_paise     bigint not null default 100000, -- ₹1,000
  last_low_balance_alert_at      timestamptz,
  updated_at                     timestamptz not null default now()
);

create index if not exists seller_wallets_user_idx
  on public.seller_wallets(seller_user_id);

-- ── 2. wallet_transactions ──────────────────────────────────────────────────
create table if not exists public.wallet_transactions (
  id               uuid primary key default gen_random_uuid(),
  seller_user_id   uuid not null references public.user_profiles(id) on delete cascade,
  type             text not null check (type in ('credit', 'debit')),
  amount_paise     bigint not null check (amount_paise > 0),
  order_id         uuid references public.orders(id) on delete set null,
  description      text not null,
  balance_after    bigint not null,
  created_at       timestamptz not null default now()
);

create index if not exists wallet_tx_seller_idx
  on public.wallet_transactions(seller_user_id, created_at desc);

create index if not exists wallet_tx_order_idx
  on public.wallet_transactions(order_id) where order_id is not null;

-- ── 3. Atomic debit RPC ───────────────────────────────────────────────────────
-- Returns true if the deduction succeeded, false if the balance was
-- insufficient. The guarded UPDATE (balance_paise >= amount) makes this safe
-- under concurrency — same pattern as increment_page_revenue (migration 018).
create or replace function public.deduct_wallet_balance(
  p_seller_id    uuid,
  p_amount_paise bigint,
  p_order_id     uuid,
  p_description  text default 'Platform fee'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance bigint;
begin
  update public.seller_wallets
     set balance_paise = balance_paise - p_amount_paise,
         updated_at    = now()
   where seller_user_id = p_seller_id
     and balance_paise  >= p_amount_paise
  returning balance_paise into v_new_balance;

  if not found then
    return false;  -- no wallet row, or insufficient balance
  end if;

  insert into public.wallet_transactions
    (seller_user_id, type, amount_paise, order_id, description, balance_after)
  values
    (p_seller_id, 'debit', p_amount_paise, p_order_id, p_description, v_new_balance);

  return true;
end;
$$;

grant execute on function public.deduct_wallet_balance(uuid, bigint, uuid, text)
  to service_role, authenticated;

-- ── 4. Atomic credit RPC (recharges) ─────────────────────────────────────────
create or replace function public.credit_wallet_balance(
  p_seller_id    uuid,
  p_amount_paise bigint,
  p_description  text default 'Wallet recharge'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance bigint;
begin
  insert into public.seller_wallets (seller_user_id, balance_paise)
  values (p_seller_id, p_amount_paise)
  on conflict (seller_user_id)
  do update set
    balance_paise = seller_wallets.balance_paise + p_amount_paise,
    updated_at    = now()
  returning balance_paise into v_new_balance;

  insert into public.wallet_transactions
    (seller_user_id, type, amount_paise, description, balance_after)
  values
    (p_seller_id, 'credit', p_amount_paise, p_description, v_new_balance);

  return v_new_balance;
end;
$$;

grant execute on function public.credit_wallet_balance(uuid, bigint, text)
  to service_role, authenticated;

-- ── 5. Row-level security ─────────────────────────────────────────────────────
-- Sellers see only their own wallet + transactions. The service role (admin
-- client used by checkout / recharge routes) bypasses RLS.
alter table public.seller_wallets      enable row level security;
alter table public.wallet_transactions enable row level security;

create policy "seller_wallets_own"
  on public.seller_wallets
  for select
  using (seller_user_id = auth.uid());

create policy "wallet_transactions_own"
  on public.wallet_transactions
  for select
  using (seller_user_id = auth.uid());

commit;
