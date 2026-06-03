-- =============================================================================
-- 043 — Admin wallet RPCs
--
-- Admin-side management of seller wallets:
--   1. admin_adjust_wallet_balance() — signed credit/debit by an admin, logged
--      as a wallet_transactions row. Rejects overdraft (balance stays >= 0).
--   2. admin_wallet_fee_summary()    — platform wallet-fee totals for the admin
--      revenue cards (PostgREST can't SUM directly).
--
-- Both run as service_role from admin server actions (which gate on is_admin).
-- =============================================================================

begin;

-- ── 1. Signed admin adjustment (credit when delta>0, debit when delta<0) ─────
create or replace function public.admin_adjust_wallet_balance(
  p_seller_id   uuid,
  p_delta_paise bigint,
  p_description text default 'Admin adjustment'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance bigint;
begin
  if p_delta_paise = 0 then
    return false;
  end if;

  -- Upsert applying the signed delta. The column's `balance_paise >= 0` CHECK
  -- rejects an overdraft on BOTH paths (insert with a negative delta for a new
  -- seller, or an update that would dip below zero) — it raises
  -- check_violation, which the handler below turns into a clean `false`.
  insert into public.seller_wallets (seller_user_id, balance_paise)
  values (p_seller_id, p_delta_paise)
  on conflict (seller_user_id)
  do update set
    balance_paise = public.seller_wallets.balance_paise + p_delta_paise,
    updated_at    = now()
  returning balance_paise into v_new_balance;

  insert into public.wallet_transactions
    (seller_user_id, type, amount_paise, description, balance_after)
  values
    (p_seller_id,
     case when p_delta_paise > 0 then 'credit' else 'debit' end,
     abs(p_delta_paise),
     p_description,
     v_new_balance);

  return true;
exception
  when check_violation then
    return false;
end;
$$;

grant execute on function public.admin_adjust_wallet_balance(uuid, bigint, text)
  to service_role;

-- ── 2. Platform wallet-fee summary ───────────────────────────────────────────
create or replace function public.admin_wallet_fee_summary()
returns table (
  total_fees_paise    bigint,
  month_fees_paise    bigint,
  low_balance_sellers bigint
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce((select sum(amount_paise) from public.wallet_transactions
               where type = 'debit'), 0)::bigint,
    coalesce((select sum(amount_paise) from public.wallet_transactions
               where type = 'debit'
                 and created_at >= date_trunc('month', now())), 0)::bigint,
    (select count(*) from public.seller_wallets
       where balance_paise <= 20000)::bigint;
$$;

grant execute on function public.admin_wallet_fee_summary() to service_role;

commit;
