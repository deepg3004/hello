-- =============================================================================
-- 020 — add products.image_url
--
-- Why:
--   app/(public)/p/[slug]/page.tsx (loadPage) does a select that includes
--   image_url, and the route's ProductRow type declares image_url: string|null.
--   The original 001 schema never created the column, so PostgREST failed
--   the entire SELECT, the product came back null, and every published
--   payment page showed "Attach a product to this page to enable checkout."
--   even when a product row was correctly attached.
-- =============================================================================

begin;

alter table public.products
  add column if not exists image_url text;

notify pgrst, 'reload schema';

commit;
