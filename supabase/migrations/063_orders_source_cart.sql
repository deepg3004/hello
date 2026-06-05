-- =============================================================================
-- 063 — allow orders.source = 'cart' (Store Phase 2b hotfix)
--
-- create-cart-order inserts orders with source='cart', but the orders_source
-- CHECK constraint only allowed direct/bump/oto/affiliate, so every cart
-- checkout failed at the order insert. Widen the constraint to include 'cart'.
-- =============================================================================

begin;

alter table public.orders drop constraint if exists orders_source_check;
alter table public.orders
  add constraint orders_source_check
  check (source = any (array['direct', 'bump', 'oto', 'affiliate', 'cart']));

commit;
