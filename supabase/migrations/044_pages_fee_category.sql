-- =============================================================================
-- 044 — pages.fee_category
--
-- Optional per-page fee category override for the admin-configurable platform
-- fee engine (lib/fees.ts). NULL → the category is derived from pages.type
-- (payment / landing / leads / telegram). A non-null value points at an
-- admin-defined custom fee category.
-- =============================================================================

begin;

alter table public.pages
  add column if not exists fee_category text;

commit;
