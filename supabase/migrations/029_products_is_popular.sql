-- 029_products_is_popular
-- Lets a plan be flagged "Most Popular" on the public page. Mirrors
-- telegram_subscription_plans.is_popular onto the product the page renders.
alter table public.products
  add column if not exists is_popular boolean default false;
