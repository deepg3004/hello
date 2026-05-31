-- ===========================================================================
-- 026_invoice_number_nullable
--
-- Bug: invoice generation crashed with
--   "null value in column \"invoice_number\" of relation \"invoices\"
--    violates not-null constraint"
-- for every paid order whose seller has no GST profile (0 invoices existed
-- for 5 paid orders on 2026-05-31).
--
-- Root cause: lib/invoice-generator.ts writes a lifecycle row in 'failed' /
-- 'queued' / 'generating' state BEFORE a number is minted (e.g. the
-- "Seller has no GST profile" early-exit at upsertInvoice). invoice_number is
-- only meaningful once status='generated', but the column was NOT NULL, so the
-- early-state INSERT threw instead of recording a debuggable failed row.
--
-- Fix: allow invoice_number to be NULL for non-generated states. The UNIQUE
-- index (invoices_invoice_number_key) is preserved — Postgres permits multiple
-- NULLs under a unique index, so issued numbers stay unique.
-- ===========================================================================

alter table public.invoices
  alter column invoice_number drop not null;
