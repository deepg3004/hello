import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set. Add the Supabase Postgres connection string to .env before starting the server.')
}

const useSsl = (process.env.DATABASE_URL || '').includes('supabase')

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  idleTimeoutMillis: 30000,
})

pool.on('error', (error) => {
  console.error('Postgres pool error:', error.message)
})

export function nowIso() {
  return new Date().toISOString()
}

export async function query(text, params) {
  return pool.query(text, params)
}

export async function getDashboardMetrics() {
  const [sent, contacts, automations] = await Promise.all([
    pool.query("SELECT COUNT(*)::int AS count FROM messages WHERE direction = 'outbound'"),
    pool.query('SELECT COUNT(*)::int AS count FROM contacts'),
    pool.query('SELECT COUNT(*)::int AS count FROM automations'),
  ])

  return {
    messagesSent: sent.rows[0].count,
    messagesSeen: 0,
    totalClicks: 0,
    followersGained: 0,
    contacts: contacts.rows[0].count,
    automations: automations.rows[0].count,
  }
}

export async function upsertContactFromEvent({
  instagramUserId,
  handle = '',
  name = '',
  source = 'Instagram webhook',
  status = 'new',
}) {
  if (!instagramUserId) return null
  const timestamp = nowIso()
  const result = await pool.query(
    `INSERT INTO contacts (instagram_user_id, handle, name, source, status, first_seen_at, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     ON CONFLICT (instagram_user_id) DO UPDATE SET
       handle = COALESCE(NULLIF(EXCLUDED.handle, ''), contacts.handle),
       name = COALESCE(NULLIF(EXCLUDED.name, ''), contacts.name),
       source = EXCLUDED.source,
       status = EXCLUDED.status,
       last_seen_at = EXCLUDED.last_seen_at
     RETURNING *`,
    [instagramUserId, handle, name, source, status, timestamp],
  )

  return result.rows[0] || null
}

export async function insertMessage({
  contactId = null,
  instagramUserId = '',
  direction,
  body = '',
  eventType = '',
  raw = null,
}) {
  await pool.query(
    `INSERT INTO messages (contact_id, instagram_user_id, direction, body, event_type, raw_json, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [contactId, instagramUserId, direction, body, eventType, raw ? JSON.stringify(raw) : null, nowIso()],
  )
}
