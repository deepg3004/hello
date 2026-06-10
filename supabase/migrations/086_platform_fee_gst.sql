-- =============================================================================
-- 086 — GST on the platform fee
--
-- The per-order platform fee is a taxable service. GST is charged ON TOP of the
-- fee and debited from the seller's wallet together with it as a single gross
-- transaction (so the migration-060 per-order idempotency guard and the
-- full-refund reversal in lib/order-reversal both stay correct — they key off
-- the order's debit amount).
--
-- This seeds the admin-editable percent. Reading code (lib/settings.getFeeConfig)
-- defaults to 18 when the row is absent, so this is purely to surface + persist
-- the value for the admin fees form. Idempotent.
-- =============================================================================

begin;

insert into public.platform_settings (key, value, description)
values
  ('platform_fee_gst_percent', '18',
   'GST %% charged on the platform fee, debited from the seller wallet together with the fee.')
on conflict (key) do nothing;

commit;
