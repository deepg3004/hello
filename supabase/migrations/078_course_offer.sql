-- Per-course promotional offer popup, shown on the course player. When unset
-- the player falls back to the seller's storefront promo (existing behaviour).
-- Shape: { enabled: bool, title, text, cta_label, cta_url }
alter table courses add column if not exists offer_config jsonb;
