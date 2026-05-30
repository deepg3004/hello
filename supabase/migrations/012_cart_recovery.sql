-- =============================================================================
-- 012 — abandoned-checkout recovery sequence
--
-- Extends abandoned_checkouts so we can:
--   * remember which BullMQ jobs we scheduled for each cart (so we can
--     cancel them when the cart is recovered)
--   * track which steps of the recovery sequence have already fired
--   * remember which Resend message ids back each email (so the Resend
--     webhook can flip open counts on the right row)
--   * pin a seller-configured "recovery coupon" code that the 24-hour
--     follow-up attaches
-- =============================================================================

begin;

-- ── abandoned_checkouts extras ────────────────────────────────────────────
alter table public.abandoned_checkouts
  add column if not exists product_id                  uuid references public.products(id) on delete set null,
  add column if not exists recovery_job_ids            jsonb default '{}'::jsonb,
  add column if not exists step_reached                text default 'pre_capture'
    check (step_reached in ('pre_capture', 'razorpay_opened', 'payment_attempted')),
  add column if not exists recovery_email1_sent_at     timestamptz,
  add column if not exists recovery_email1_message_id  text,
  add column if not exists recovery_whatsapp_sent_at   timestamptz,
  add column if not exists recovery_email2_sent_at     timestamptz,
  add column if not exists recovery_email2_message_id  text,
  add column if not exists email_opens                 integer default 0,
  add column if not exists email_open_events           jsonb default '[]'::jsonb,
  add column if not exists last_seen_at                timestamptz default now(),
  add column if not exists updated_at                  timestamptz default now();

-- Fast lookups by Resend message id for the webhook handler.
create index if not exists abandoned_checkouts_email1_msg_idx
  on public.abandoned_checkouts(recovery_email1_message_id);
create index if not exists abandoned_checkouts_email2_msg_idx
  on public.abandoned_checkouts(recovery_email2_message_id);
create index if not exists abandoned_checkouts_status_idx
  on public.abandoned_checkouts(status);
create index if not exists abandoned_checkouts_seller_created_idx
  on public.abandoned_checkouts(seller_user_id, created_at desc);

-- updated_at trigger
create or replace function public.abandoned_checkouts_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists abandoned_checkouts_set_updated_at on public.abandoned_checkouts;
create trigger abandoned_checkouts_set_updated_at
  before update on public.abandoned_checkouts
  for each row execute function public.abandoned_checkouts_set_updated_at();

-- ── Seller-level "recovery coupon" pin ────────────────────────────────────
alter table public.user_profiles
  add column if not exists recovery_coupon_id  uuid references public.coupons(id) on delete set null;

commit;
