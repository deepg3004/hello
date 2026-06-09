-- Review-request automation: track which paid orders we've already asked for a
-- review so the cron sends at most one ask per order. Additive + nullable (no
-- CHECK constraint), so no constraint-violation risk on existing rows.
begin;

alter table public.orders
  add column if not exists review_requested_at timestamptz;

commit;
