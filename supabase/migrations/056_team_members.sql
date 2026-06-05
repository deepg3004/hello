-- =============================================================================
-- 056 — Team & Roles / RBAC (Session 15)
--
-- Lets a seller (account owner) invite team members and assign a preset role
-- (manager / staff / viewer). A member logs in with their OWN account but acts
-- ON the owner's account: server code resolves an "effective owner id" and
-- scopes every business resource to it (see lib/account-context.ts), filtered
-- by the role's permissions (lib/rbac.ts). The account owner is implicit (no
-- row) and always has the full "owner" role.
--
-- Authorization for the dashboard is enforced in the application layer (all
-- dashboard reads/writes use the service-role admin client). The acts_for()
-- helper + policy rewrites below are defense-in-depth so a team member's
-- (anon-key, RLS-bound) client can also read the owner's rows.
-- =============================================================================

begin;

create table if not exists public.team_members (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references public.user_profiles(id) on delete cascade,
  member_user_id    uuid references public.user_profiles(id) on delete cascade, -- null until accepted
  email             text not null,                                 -- invited email (lowercased)
  role              text not null check (role in ('manager', 'staff', 'viewer')),
  status            text not null default 'invited' check (status in ('invited', 'active', 'revoked')),
  invite_token_hash text,                                          -- sha256 of the accept-link token
  invited_at        timestamptz not null default now(),
  accepted_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (owner_id, email)
);

create index if not exists team_members_member_idx on public.team_members (member_user_id) where member_user_id is not null;
create index if not exists team_members_owner_idx  on public.team_members (owner_id);

alter table public.team_members enable row level security;

-- A member (or the owner) can read their own membership rows. All writes go
-- through the service-role admin client (no write policy).
create policy "team_members_self_select"
  on public.team_members for select
  using (auth.uid() = member_user_id or auth.uid() = owner_id);

-- ---- effective-owner helper -------------------------------------------------
-- True when the current auth user IS the owner, or is an ACTIVE team member of
-- that owner's account. SECURITY DEFINER so it can read team_members under RLS.
create or replace function public.acts_for(owner uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    auth.uid() = owner
    or exists (
      select 1 from public.team_members tm
      where tm.owner_id = owner
        and tm.member_user_id = auth.uid()
        and tm.status = 'active'
    );
$$;

-- ---- defense-in-depth: widen owner policies to team members -----------------
-- Rewrite the core seller-owned policies from `auth.uid() = <owner col>` to
-- `acts_for(<owner col>)`. Service-role-only tables (no owner policy) are left
-- untouched — they're never read through an RLS-bound client.

drop policy if exists "pages_owner_all" on public.pages;
create policy "pages_owner_all" on public.pages for all
  using (public.acts_for(user_id)) with check (public.acts_for(user_id));

drop policy if exists "products_owner_all" on public.products;
create policy "products_owner_all" on public.products for all
  using (public.acts_for(user_id)) with check (public.acts_for(user_id));

drop policy if exists "orders_seller_select" on public.orders;
create policy "orders_seller_select" on public.orders for select
  using (public.acts_for(seller_user_id));

drop policy if exists "transactions_owner_select" on public.transactions;
create policy "transactions_owner_select" on public.transactions for select
  using (public.acts_for(user_id));

drop policy if exists "lead_captures_owner_select" on public.lead_captures;
create policy "lead_captures_owner_select" on public.lead_captures for select
  using (public.acts_for(seller_user_id));

drop policy if exists "coupons_owner_all" on public.coupons;
create policy "coupons_owner_all" on public.coupons for all
  using (public.acts_for(user_id)) with check (public.acts_for(user_id));

drop policy if exists "upsells_owner_all" on public.upsells;
create policy "upsells_owner_all" on public.upsells for all
  using (public.acts_for(user_id)) with check (public.acts_for(user_id));

drop policy if exists "abandoned_checkouts_owner_select" on public.abandoned_checkouts;
create policy "abandoned_checkouts_owner_select" on public.abandoned_checkouts for select
  using (public.acts_for(seller_user_id));

drop policy if exists "invoices_owner_select" on public.invoices;
create policy "invoices_owner_select" on public.invoices for select
  using (public.acts_for(seller_user_id));

drop policy if exists "telegram_vip_groups_owner_all" on public.telegram_vip_groups;
create policy "telegram_vip_groups_owner_all" on public.telegram_vip_groups for all
  using (public.acts_for(user_id)) with check (public.acts_for(user_id));

drop policy if exists "telegram_memberships_owner_select" on public.telegram_memberships;
create policy "telegram_memberships_owner_select" on public.telegram_memberships for select
  using (group_id in (select id from public.telegram_vip_groups where public.acts_for(user_id)));

drop policy if exists "pixel_configs_owner_all" on public.pixel_configs;
create policy "pixel_configs_owner_all" on public.pixel_configs for all
  using (page_id in (select id from public.pages where public.acts_for(user_id)))
  with check (page_id in (select id from public.pages where public.acts_for(user_id)));

drop policy if exists "social_proof_events_owner_select" on public.social_proof_events;
create policy "social_proof_events_owner_select" on public.social_proof_events for select
  using (page_id in (select id from public.pages where public.acts_for(user_id)));

commit;
