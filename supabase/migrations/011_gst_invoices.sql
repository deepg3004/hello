-- =============================================================================
-- 011 — GST profile + automatic invoice generation
--
-- Adds the columns we need to:
--   * store a seller's GST profile (legal name, registered address, state
--     code, default HSN/SAC + rate)
--   * collect optional buyer GST details at checkout (B2B path)
--   * persist a fully-rendered, sequenced GST invoice for every paid order
-- =============================================================================

begin;

-- ── Seller GST profile (on user_profiles) ──────────────────────────────────
alter table public.user_profiles
  add column if not exists legal_business_name  text,
  -- gstin column already exists in 001; this is the format-validated copy
  add column if not exists gst_address          jsonb,
  add column if not exists state_code           text check (state_code is null or state_code ~ '^[0-9]{2}$'),
  add column if not exists default_hsn_sac      text,
  add column if not exists default_gst_rate     decimal(5, 2)
    check (default_gst_rate is null or default_gst_rate in (0, 5, 12, 18, 28)),
  add column if not exists gst_verified_at      timestamptz;

-- ── Buyer GST capture (on orders) ──────────────────────────────────────────
alter table public.orders
  add column if not exists buyer_gstin        text,
  add column if not exists buyer_state_code   text;

create index if not exists orders_buyer_gstin_idx on public.orders(buyer_gstin);

-- ── Invoices table — extend the 001 stub ───────────────────────────────────
alter table public.invoices
  add column if not exists financial_year       text,
  add column if not exists sequence_num         integer,
  add column if not exists invoice_type         text check (invoice_type in ('tax_invoice', 'bill_of_supply')),
  add column if not exists place_of_supply      text,
  add column if not exists seller_state_code    text,
  add column if not exists buyer_state_code     text,
  add column if not exists buyer_address        jsonb,
  add column if not exists hsn_sac              text,
  add column if not exists invoice_date         timestamptz default now(),
  add column if not exists pdf_storage_path     text,
  add column if not exists status               text default 'queued'
    check (status in ('queued', 'generating', 'generated', 'failed')),
  add column if not exists failure_reason       text,
  add column if not exists amount_in_words      text,
  add column if not exists updated_at           timestamptz default now();

-- Per-seller, per-FY sequence — referenced by the FOR-UPDATE block in
-- lib/invoice-generator.ts. We don't enforce a unique constraint to keep room
-- for regenerations, but the dispatcher only ever picks the next free slot.
create index if not exists invoices_seller_fy_idx
  on public.invoices(seller_user_id, financial_year, sequence_num);

create index if not exists invoices_status_idx on public.invoices(status);

-- updated_at trigger
create or replace function public.invoices_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.invoices_set_updated_at();

-- ── Storage bucket (private) ───────────────────────────────────────────────
-- The PDF binary lives in storage.objects, not in the row itself.
insert into storage.buckets (id, name, public, file_size_limit)
values ('invoices', 'invoices', false, 5242880)
on conflict (id) do nothing;

-- Sellers can read their own invoices; admins can read all.
drop policy if exists "Sellers read own invoices" on storage.objects;
create policy "Sellers read own invoices"
  on storage.objects for select
  using (
    bucket_id = 'invoices'
    and (
      auth.uid()::text = split_part(name, '/', 1)
      or coalesce((select is_admin from public.user_profiles where id = auth.uid()), false)
    )
  );

-- Only service-role inserts (the worker uses the admin client).
drop policy if exists "Service role writes invoices" on storage.objects;
-- Service role bypasses RLS by default; we leave write policy off so anon /
-- authenticated can never upload arbitrarily.

commit;
