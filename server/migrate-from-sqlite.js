/**
 * One-off migration: read the old SQLite file and copy every row into Supabase Postgres.
 * Run on the VPS once, after you have set DATABASE_URL in .env and applied schema.sql in Supabase.
 *
 *   npm install better-sqlite3   # only needed for the migration
 *   node server/migrate-from-sqlite.js /var/www/linkplease/server/data/linkplease.sqlite
 *
 * Safe to re-run: each table is truncated only if --reset is passed.
 */

import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { pool } from './db.js'

dotenv.config()

const sqlitePath = process.argv[2] || path.resolve(process.cwd(), 'server', 'data', 'linkplease.sqlite')
const reset = process.argv.includes('--reset')

if (!fs.existsSync(sqlitePath)) {
  console.log(`No SQLite file found at ${sqlitePath}. Nothing to migrate.`)
  process.exit(0)
}

let Database
try {
  ({ default: Database } = await import('better-sqlite3'))
} catch {
  console.error('better-sqlite3 is not installed. Run: npm install better-sqlite3')
  process.exit(1)
}

const sqlite = new Database(sqlitePath, { readonly: true })

async function copyTable(table, columns, transform = (row) => row) {
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all()
  if (!rows.length) {
    console.log(`- ${table}: 0 rows`)
    return
  }

  if (reset) {
    await pool.query(`TRUNCATE ${table} RESTART IDENTITY CASCADE`)
  }

  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
  const colList = columns.join(', ')

  for (const row of rows) {
    const values = columns.map((col) => transform(row)[col] ?? null)
    await pool.query(
      `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      values,
    )
  }

  console.log(`- ${table}: ${rows.length} rows copied`)
}

try {
  console.log(`Migrating from ${sqlitePath} ...`)

  await copyTable('instagram_connections', [
    'id', 'status', 'message', 'username', 'instagram_account_id', 'profile_picture_url',
    'facebook_page_id', 'facebook_page_name', 'page_access_token', 'user_access_token',
    'token_type', 'expires_in', 'connected_at', 'updated_at',
  ])

  await copyTable('automations', [
    'id', 'name', 'trigger', 'opening_message', 'cta_label', 'cta_url',
    'status', 'created_at', 'updated_at',
  ])

  await copyTable('contacts', [
    'id', 'instagram_user_id', 'handle', 'name', 'source', 'status',
    'first_seen_at', 'last_seen_at',
  ])

  await copyTable('messages', [
    'id', 'contact_id', 'instagram_user_id', 'direction', 'body',
    'event_type', 'raw_json', 'created_at',
  ])

  await copyTable('products', [
    'id', 'name', 'slug', 'description', 'seller_name', 'seller_email', 'cover_image',
    'button_text', 'pricing_mode', 'suggested_price', 'accent_color', 'theme',
    'resource_link', 'settings_json', 'price', 'currency', 'payments_enabled',
    'created_at', 'updated_at',
  ])

  await copyTable('orders', [
    'id', 'customer_email', 'product_name', 'amount', 'payout_amount',
    'currency', 'created_at',
  ])

  for (const table of ['automations', 'contacts', 'messages', 'products', 'orders']) {
    await pool.query(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'),
              COALESCE((SELECT MAX(id) FROM ${table}), 1))`,
    )
  }

  console.log('Migration complete.')
} catch (error) {
  console.error('Migration failed:', error.message)
  process.exitCode = 1
} finally {
  sqlite.close()
  await pool.end()
}
