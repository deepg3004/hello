-- =============================================================================
-- 092 — password-protected builder pages
--
-- A seller can lock a published builder page behind a shared password (members /
-- paid content). When access_password is set, the public renderer shows an
-- unlock form until the visitor enters it (a signed cookie then keeps it open).
-- Null/empty = public (the default for every existing page → no behaviour change).
-- =============================================================================

begin;

alter table public.builder_pages
  add column if not exists access_password text;

commit;
