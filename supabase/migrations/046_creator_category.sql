-- =============================================================================
-- 046 — Creator category
-- A self-selected niche per seller. Internal use only (onboarding personalisation
-- + admin insight); not shown to buyers. Fixed list enforced via CHECK.
-- =============================================================================
begin;

alter table public.user_profiles
  add column if not exists creator_category text
    check (creator_category is null or creator_category in (
      'finance', 'astrology', 'coaching', 'digital_marketing', 'medical',
      'education', 'fitness', 'design', 'technology', 'legal', 'travel',
      'beauty', 'entertainment', 'other'
    ));

commit;
