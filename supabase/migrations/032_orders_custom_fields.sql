-- 032_orders_custom_fields
-- Answers to seller-defined custom checkout questions, stored per order.
alter table public.orders
  add column if not exists custom_fields jsonb;
