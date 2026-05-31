-- 030_membership_invite_link
-- Store each member's invite link on the membership so the seller dashboard
-- can show it, regenerate it, and so manual-added members (no order) have one.
alter table public.telegram_memberships
  add column if not exists invite_link text;
