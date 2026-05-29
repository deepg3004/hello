-- LinkPlease database schema for Supabase (PostgreSQL).
-- Paste this whole file into Supabase -> SQL Editor -> New query -> Run.
-- Safe to re-run: every statement uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS instagram_connections (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'connected',
  message TEXT,
  username TEXT,
  instagram_account_id TEXT,
  profile_picture_url TEXT,
  facebook_page_id TEXT,
  facebook_page_name TEXT,
  page_access_token TEXT,
  user_access_token TEXT,
  token_type TEXT,
  expires_in BIGINT,
  connected_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS automations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  opening_message TEXT,
  cta_label TEXT,
  cta_url TEXT,
  status TEXT NOT NULL DEFAULT 'inactive',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
  id BIGSERIAL PRIMARY KEY,
  instagram_user_id TEXT UNIQUE,
  handle TEXT,
  name TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  contact_id BIGINT REFERENCES contacts(id) ON DELETE SET NULL,
  instagram_user_id TEXT,
  direction TEXT NOT NULL,
  body TEXT,
  event_type TEXT,
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  seller_name TEXT,
  seller_email TEXT,
  cover_image TEXT,
  button_text TEXT,
  pricing_mode TEXT NOT NULL DEFAULT 'fixed',
  suggested_price BIGINT NOT NULL DEFAULT 0,
  accent_color TEXT NOT NULL DEFAULT '#F5C518',
  theme TEXT NOT NULL DEFAULT 'Dawn',
  resource_link TEXT,
  settings_json JSONB,
  price BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  payments_enabled SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  customer_email TEXT NOT NULL,
  product_name TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  payout_amount BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_last_seen ON contacts(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_automations_created ON automations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
