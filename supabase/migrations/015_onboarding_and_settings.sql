-- =============================================================================
-- 015 — onboarding state + platform settings seeds + 014 fixup
--
-- 1. user_profiles gets onboarded_at + welcome_dismissed_at so the dashboard
--    knows whether to show the welcome banner / push to /dashboard/onboarding.
-- 2. platform_settings (from 004) gets seeded with the keys the new admin
--    settings page exposes: maintenance, feature flags, support contacts,
--    legal URLs, KYC threshold.
-- 3. Fix-up for 014: the original migration inserted into a non-existent
--    "system_settings" table — re-seed the same row into the real
--    platform_settings instead. Safe to re-run.
-- =============================================================================

begin;

-- ── 1. Onboarding state ──────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists onboarded_at           timestamptz,
  add column if not exists welcome_dismissed_at   timestamptz;

-- ── 2. Seeds for the admin platform-settings page ────────────────────────
insert into public.platform_settings (key, value, description)
values
  -- Identity
  ('platform_name',          'InvoxAI',           'Public-facing platform name shown in emails + maintenance page.'),
  ('platform_logo_url',      '',                  'Optional URL for the platform logo (used in transactional emails).'),

  -- Lifecycle
  ('maintenance_mode',       'false',             'When true, every public + dashboard request 503s to the maintenance page. Admins always pass through.'),
  ('maintenance_message',    'We''ll be back shortly.', 'Customer-facing message shown on the maintenance page.'),

  -- Support + legal
  ('support_email',          'support@invoxai.io', 'Public support inbox surfaced in emails + the help link.'),
  ('support_telegram_url',   '',                   'Optional Telegram support channel (https://t.me/...).'),
  ('terms_url',              '',                   'Public Terms of Service URL.'),
  ('privacy_url',            '',                   'Public Privacy Policy URL.'),

  -- Email envelope
  ('email_from_address',     'noreply@invoxai.io', 'Envelope From for all transactional sends.'),
  ('email_from_name',        'InvoxAI',            'Display name paired with email_from_address.'),
  ('email_reply_to',         'support@invoxai.io', 'Reply-To header so buyer replies route to a monitored inbox.'),

  -- Per-plan commission overrides — JSON encoded as text. Keys = plan ids.
  ('commission_per_plan',    '{"free":5,"starter":4.5,"pro":3.5,"business":2.5}',
                             'Per-plan commission % overrides. JSON object — falls back to platform_commission_percent when a plan is missing.'),

  -- KYC threshold
  ('kyc_l3_gmv_threshold',   '500000',           'Seller GMV (₹) above which KYC Level 3 (Aadhaar + Selfie) becomes required.'),

  -- Feature flags
  ('feature_affiliate',      'true',              'Master switch for the affiliate system (Prompt #25).'),
  ('feature_custom_domains', 'true',              'Master switch for custom domains on /p/[slug] pages.'),
  ('feature_ab_testing',     'true',              'Master switch for /dashboard/pages/[id]/ab-test.'),
  ('feature_telegram_vip',   'true',              'Master switch for Telegram VIP-group sales.'),

  -- 014 fixup — the row originally went into a table that didn't exist.
  ('allow_custom_scripts',   'true',              'When true, Pro+ sellers can paste a custom <script> block into the Pixels tab.')
on conflict (key) do nothing;

commit;
