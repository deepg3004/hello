-- 028_products_original_price
-- Optional crossed-out "compare at" price so plan cards can show a discount
-- (e.g. ~~₹85,999~~ → ₹19,999, "77% OFF"). NULL = no discount shown.
alter table public.products
  add column if not exists original_price decimal(10,2);
