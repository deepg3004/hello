import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const dataDir = path.resolve(process.cwd(), 'server', 'data')
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'linkplease.sqlite')

fs.mkdirSync(dataDir, { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

db.exec(`
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
    expires_in INTEGER,
    connected_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS automations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    trigger TEXT NOT NULL,
    opening_message TEXT,
    cta_label TEXT,
    cta_url TEXT,
    status TEXT NOT NULL DEFAULT 'inactive',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instagram_user_id TEXT,
    handle TEXT,
    name TEXT,
    source TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    UNIQUE(instagram_user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER,
    instagram_user_id TEXT,
    direction TEXT NOT NULL,
    body TEXT,
    event_type TEXT,
    raw_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(contact_id) REFERENCES contacts(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    payments_enabled INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_email TEXT NOT NULL,
    product_name TEXT NOT NULL,
    amount INTEGER NOT NULL DEFAULT 0,
    payout_amount INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    created_at TEXT NOT NULL
  );
`)

export function nowIso() {
  return new Date().toISOString()
}

export function getDashboardMetrics() {
  return {
    messagesSent: db.prepare("SELECT COUNT(*) AS count FROM messages WHERE direction = 'outbound'").get().count,
    messagesSeen: 0,
    totalClicks: 0,
    followersGained: 0,
    contacts: db.prepare('SELECT COUNT(*) AS count FROM contacts').get().count,
    automations: db.prepare('SELECT COUNT(*) AS count FROM automations').get().count,
  }
}

export function upsertContactFromEvent({ instagramUserId, handle = '', name = '', source = 'Instagram webhook', status = 'new' }) {
  if (!instagramUserId) return null
  const timestamp = nowIso()
  db.prepare(`
    INSERT INTO contacts (instagram_user_id, handle, name, source, status, first_seen_at, last_seen_at)
    VALUES (@instagramUserId, @handle, @name, @source, @status, @timestamp, @timestamp)
    ON CONFLICT(instagram_user_id) DO UPDATE SET
      handle = COALESCE(NULLIF(excluded.handle, ''), contacts.handle),
      name = COALESCE(NULLIF(excluded.name, ''), contacts.name),
      source = excluded.source,
      status = excluded.status,
      last_seen_at = excluded.last_seen_at
  `).run({ instagramUserId, handle, name, source, status, timestamp })

  return db.prepare('SELECT * FROM contacts WHERE instagram_user_id = ?').get(instagramUserId)
}

export function insertMessage({ contactId = null, instagramUserId = '', direction, body = '', eventType = '', raw = null }) {
  db.prepare(`
    INSERT INTO messages (contact_id, instagram_user_id, direction, body, event_type, raw_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(contactId, instagramUserId, direction, body, eventType, raw ? JSON.stringify(raw) : null, nowIso())
}
