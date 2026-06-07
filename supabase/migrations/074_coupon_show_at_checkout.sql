-- Opt-in flag to publicly list a coupon at checkout so buyers can tap to apply
-- it. Defaults false so existing/secret codes stay hidden until the seller
-- chooses to surface them.
alter table public.coupons
  add column if not exists show_at_checkout boolean not null default false;
