-- =============================================================================
-- 041 — Seller gateway configuration
--
-- Sellers connect their own payment gateway (Razorpay / Cashfree / ...). The
-- key_id / key_secret / webhook_secret are stored ENCRYPTED at rest
-- (AES-256-GCM via lib/gateway-crypto.ts — never plaintext). Checkout loads a
-- seller's keys on demand via lib/gateway-loader.ts.
--
-- SECURITY: RLS is enabled with NO client policies — encrypted credentials must
-- never be readable from the browser. All access goes through the service-role
-- admin client (server actions + checkout routes), which bypasses RLS.
-- =============================================================================

begin;

create table if not exists public.seller_gateway_config (
  id                  uuid primary key default gen_random_uuid(),
  seller_user_id      uuid unique not null
                        references public.user_profiles(id) on delete cascade,

  gateway_type        text not null
    check (gateway_type in ('razorpay', 'cashfree', 'payu', 'instamojo', 'stripe')),

  -- Encrypted at rest — iv || authTag || ciphertext, hex-encoded.
  key_id_enc          text not null,
  key_secret_enc      text not null,
  webhook_secret_enc  text,

  is_active           boolean not null default true,
  -- Set true after a successful test payment proves the keys work.
  is_verified         boolean not null default false,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists seller_gateway_config_user_idx
  on public.seller_gateway_config(seller_user_id);

-- RLS on, no policies: deny all direct client access to credential rows.
-- Service role (admin client) bypasses RLS for server-side reads/writes.
alter table public.seller_gateway_config enable row level security;

commit;
