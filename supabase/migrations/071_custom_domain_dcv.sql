-- =============================================================================
-- 071 — custom-domain DCV (domain-control validation) records
--
-- When a seller's custom domain is registered with Cloudflare for SaaS, CF may
-- return one or more validation records (a TXT/HTTP token) the seller must add
-- at their DNS host to finish issuing the TLS certificate. We stash them so the
-- dashboard can show the seller exactly what to add while the cert is still
-- provisioning.
--
-- Shape (jsonb array):
--   [{ "type": "txt", "name": "_cf-...", "value": "...", "status": "pending" }]
-- =============================================================================

begin;

alter table public.user_profiles
  add column if not exists custom_domain_dcv jsonb;

commit;
