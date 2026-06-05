-- =============================================================================
-- 060 — make the platform wallet-fee debit idempotent per order
--
-- Audit finding: deduct_wallet_balance decremented the balance + inserted a
-- wallet_transactions row unconditionally. The app-layer fix gates verify-payment
-- on the pending→paid transition (so a racing/retried confirm no longer reaches
-- this RPC twice) — this adds defense-in-depth at the data layer so a duplicate
-- *debit for the same order* can never double-charge, whatever the caller does.
--
-- We do NOT add a UNIQUE index (existing rows from before this fix may already
-- contain a duplicate debit, which would make index creation fail). Instead the
-- RPC short-circuits when a debit already exists for the order — idempotent and
-- safe to apply on live data. credit_wallet_balance is unchanged.
-- =============================================================================

begin;

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
  -- Idempotency: if this order was already debited, treat as success without
  -- charging again (the fee is one-per-order).
  if p_order_id is not null and exists (
    select 1 from public.wallet_transactions
     where order_id = p_order_id and type = 'debit'
  ) then
    return true;
  end if;

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

commit;
