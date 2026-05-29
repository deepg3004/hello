import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getDashboardMetrics, insertMessage, nowIso, pool, upsertContactFromEvent } from './db.js'
import {
  buildAuthUrl,
  exchangeCodeForToken,
  getConnectedInstagramAccounts,
  getConfigStatus,
  getMetaConfig,
  sendInstagramTextMessage,
} from './meta.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 8080)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: process.env.CORS_ORIGIN || true }))
app.use(express.json({ limit: '2mb' }))
app.use(morgan('dev'))

app.get('/api/health', async (_request, response) => {
  let dbOk = false
  try {
    await pool.query('SELECT 1')
    dbOk = true
  } catch (error) {
    console.error('Health DB check failed:', error.message)
  }

  response.json({
    ok: true,
    service: 'linkplease-live-backend',
    database: dbOk ? 'supabase-postgres' : 'unreachable',
    meta: getConfigStatus(),
  })
})

app.get('/api/dashboard', async (_request, response) => {
  try {
    response.json({
      ok: true,
      metrics: await getDashboardMetrics(),
    })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.get('/api/automations', async (_request, response) => {
  try {
    const result = await pool.query('SELECT * FROM automations ORDER BY created_at DESC')
    response.json({ ok: true, automations: result.rows })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.post('/api/automations', async (request, response) => {
  const timestamp = nowIso()
  const {
    name = 'New automation',
    trigger = 'User comments on post or reel',
    openingMessage = '',
    ctaLabel = '',
    ctaUrl = '',
    status = 'inactive',
  } = request.body || {}

  try {
    const result = await pool.query(
      `INSERT INTO automations (name, trigger, opening_message, cta_label, cta_url, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING *`,
      [name, trigger, openingMessage, ctaLabel, ctaUrl, status, timestamp],
    )
    response.status(201).json({ ok: true, automation: result.rows[0] })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.patch('/api/automations/:id/status', async (request, response) => {
  const status = request.body?.status === 'active' ? 'active' : 'inactive'
  try {
    const result = await pool.query(
      'UPDATE automations SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *',
      [status, nowIso(), request.params.id],
    )
    response.json({ ok: true, automation: result.rows[0] || null })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.get('/api/contacts', async (_request, response) => {
  try {
    const result = await pool.query('SELECT * FROM contacts ORDER BY last_seen_at DESC')
    response.json({ ok: true, contacts: result.rows })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.get('/api/products', async (_request, response) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY created_at DESC')
    response.json({ ok: true, products: result.rows })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.post('/api/products', async (request, response) => {
  const timestamp = nowIso()
  const body = request.body || {}
  const price = toMinorUnits(body.minimumPrice || body.price)
  const suggestedPrice = toMinorUnits(body.suggestedPrice)
  const slug = slugify(body.slug || body.title || 'product')

  const settingsJson = JSON.stringify({
    phoneRequired: Boolean(body.phoneRequired),
    emailOtp: Boolean(body.emailOtp),
    phoneOtp: Boolean(body.phoneOtp),
    limitQuantity: Boolean(body.limitQuantity),
  })

  try {
    const result = await pool.query(
      `INSERT INTO products (
        name, slug, description, seller_name, seller_email, cover_image, button_text,
        pricing_mode, suggested_price, accent_color, theme, resource_link, settings_json,
        price, currency, payments_enabled, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)
      RETURNING *`,
      [
        body.title || body.name || 'Untitled product',
        slug,
        body.description || '',
        body.sellerName || '',
        body.sellerEmail || '',
        body.coverImage || '',
        body.buttonText || 'Make Payment',
        body.pricingMode || 'fixed',
        suggestedPrice,
        body.accent || '#F5C518',
        body.theme || 'Dawn',
        body.resourceLink || '',
        settingsJson,
        price,
        body.currency || 'INR',
        0,
        timestamp,
      ],
    )
    response.status(201).json({ ok: true, product: result.rows[0] })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.get('/api/orders', async (_request, response) => {
  try {
    const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC')
    response.json({ ok: true, orders: result.rows })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.get('/api/instagram/connection', async (_request, response) => {
  try {
    response.json({
      ok: true,
      connectedAccount: await readConnectedAccount(),
    })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.delete('/api/instagram/connection', async (_request, response) => {
  try {
    await pool.query('DELETE FROM instagram_connections WHERE id = 1')
    response.json({
      ok: true,
      message: 'Instagram account disconnected.',
    })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.post('/api/admin/config', async (request, response) => {
  if (!isAdminAuthorized(request)) {
    response.status(401).json({
      ok: false,
      message: 'Invalid admin setup key.',
    })
    return
  }

  const updates = mapAdminConfigToEnv(request.body || {})
  const allowedKeys = Object.keys(updates)

  if (!allowedKeys.length) {
    response.status(400).json({
      ok: false,
      message: 'No supported config fields were provided.',
    })
    return
  }

  try {
    await writeEnvValues(updates)
    Object.assign(process.env, updates)
    response.json({
      ok: true,
      message: 'Backend config saved. Restart the server after changing live credentials.',
      meta: getConfigStatus(),
    })
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: 'Could not save backend config.',
      error: error.message,
    })
  }
})

app.get('/auth/meta', (request, response) => {
  const state = request.query.state?.toString() || 'connect_instagram'
  const config = getMetaConfig()

  if (!config.appId || !config.redirectUri) {
    response.status(400).json({
      ok: false,
      message: 'Add META_APP_ID and META_REDIRECT_URI before starting Meta OAuth.',
    })
    return
  }

  response.redirect(buildAuthUrl(state))
})

app.get('/auth/meta/callback', async (request, response) => {
  const code = request.query.code?.toString()

  if (!code) {
    response.status(400).json({
      ok: false,
      message: 'Meta callback did not include an OAuth code.',
      query: request.query,
    })
    return
  }

  try {
    const tokenResult = await exchangeCodeForToken(code)
    if (!tokenResult.ok) {
      response.status(502).json({
        ok: false,
        message: 'Meta token exchange failed.',
        tokenResult,
      })
      return
    }

    const connectedAccount = await createConnectedAccount(tokenResult.payload)
    await saveConnectedAccount(connectedAccount)
    response.redirect('/?instagram=connected')
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: 'Meta token exchange crashed.',
      error: error.message,
    })
  }
})

app.get('/api/webhooks/instagram', (request, response) => {
  const config = getMetaConfig()
  const mode = request.query['hub.mode']
  const token = request.query['hub.verify_token']
  const challenge = request.query['hub.challenge']

  if (mode === 'subscribe' && token === config.verifyToken) {
    response.status(200).send(challenge)
    return
  }

  response.sendStatus(403)
})

app.post('/api/webhooks/instagram', async (request, response) => {
  const events = normalizeInstagramEvents(request.body)
  console.log('Instagram webhook event received:', JSON.stringify(events, null, 2))

  for (const event of events) {
    try {
      await handleAutomationEvent(event)
    } catch (error) {
      console.error('Automation event failed:', error.message)
    }
  }

  response.sendStatus(200)
})

app.post('/api/messages/send', async (request, response) => {
  const { recipientId, text } = request.body

  if (!recipientId || !text) {
    response.status(400).json({
      ok: false,
      message: 'recipientId and text are required.',
    })
    return
  }

  try {
    const result = await sendInstagramTextMessage(recipientId, text)
    response.status(result.ok || result.skipped ? 200 : 502).json(result)
  } catch (error) {
    response.status(500).json({
      ok: false,
      message: 'Message send crashed.',
      error: error.message,
    })
  }
})

app.use(express.static(distDir))

app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'))
})

app.listen(port, () => {
  console.log(`LinkPlease backend running on http://127.0.0.1:${port}`)
})

function normalizeInstagramEvents(body) {
  if (!body?.entry) return []

  return body.entry.flatMap((entry) => {
    const messaging = entry.messaging || []
    const changes = entry.changes || []

    return [
      ...messaging.map((item) => ({
        type: 'message',
        senderId: item.sender?.id,
        recipientId: item.recipient?.id,
        text: item.message?.text || '',
        raw: item,
      })),
      ...changes.map((change) => ({
        type: change.field,
        value: change.value,
        raw: change,
      })),
    ]
  })
}

async function handleAutomationEvent(event) {
  if (event.type !== 'message' || !event.senderId || !event.text) return

  const contact = await upsertContactFromEvent({
    instagramUserId: event.senderId,
    source: 'Instagram DM',
    status: 'messaged',
  })
  await insertMessage({
    contactId: contact?.id,
    instagramUserId: event.senderId,
    direction: 'inbound',
    body: event.text,
    eventType: event.type,
    raw: event.raw,
  })

  const lowerText = event.text.toLowerCase()
  if (!lowerText.includes('guide') && !lowerText.includes('link')) return

  const reply = 'Thanks for your message. Here is your link: https://hello.invoxai.io/product/creator-growth-playbook'
  await sendInstagramTextMessage(event.senderId, reply)
  await insertMessage({
    contactId: contact?.id,
    instagramUserId: event.senderId,
    direction: 'outbound',
    body: reply,
    eventType: 'automation_reply',
  })
}

function isAdminAuthorized(request) {
  const setupKey = process.env.ADMIN_SETUP_KEY || 'local-admin-key'
  return request.headers['x-admin-setup-key'] === setupKey
}

function mapAdminConfigToEnv(body) {
  return removeEmptyValues({
    META_APP_ID: body.appId,
    META_APP_SECRET: body.appSecret,
    META_ACCESS_TOKEN: body.accessToken,
    META_VERIFY_TOKEN: body.verifyToken,
    META_GRAPH_VERSION: body.graphVersion,
    META_REDIRECT_URI: body.redirectUri,
    PUBLIC_WEBHOOK_URL: body.webhookUrl,
    INSTAGRAM_ACCOUNT_ID: body.instagramAccountId,
    FACEBOOK_PAGE_ID: body.facebookPageId,
    META_BUSINESS_ID: body.businessId,
  })
}

function removeEmptyValues(values) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => typeof value === 'string' && value.trim()),
  )
}

async function writeEnvValues(updates) {
  const envPath = path.join(rootDir, '.env')
  const existing = await fs.readFile(envPath, 'utf8').catch(() => '')
  const lines = existing
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .filter((line) => !Object.keys(updates).some((key) => line.startsWith(`${key}=`)))

  const nextLines = [
    ...lines,
    ...Object.entries(updates).map(([key, value]) => `${key}=${escapeEnvValue(value)}`),
  ]

  await fs.writeFile(envPath, `${nextLines.join('\n')}\n`, 'utf8')
}

function escapeEnvValue(value) {
  if (/[\s#"'`]/.test(value)) return JSON.stringify(value)
  return value
}

async function createConnectedAccount(tokenPayload) {
  const pagesResult = await getConnectedInstagramAccounts(tokenPayload.access_token)
  const page = pagesResult.payload?.data?.find((item) => item.instagram_business_account)
  const instagram = page?.instagram_business_account

  return {
    connectedAt: new Date().toISOString(),
    status: instagram ? 'connected' : 'token_received',
    message: instagram
      ? 'Instagram account connected.'
      : 'Login worked, but no Instagram Professional account was returned. Check Page connection and permissions.',
    instagramAccountId: instagram?.id || '',
    username: instagram?.username || '',
    profilePictureUrl: instagram?.profile_picture_url || '',
    facebookPageId: page?.id || '',
    facebookPageName: page?.name || '',
    pageAccessToken: page?.access_token || '',
    userAccessToken: tokenPayload.access_token || '',
    tokenType: tokenPayload.token_type || '',
    expiresIn: tokenPayload.expires_in || null,
  }
}

async function readConnectedAccount() {
  const result = await pool.query('SELECT * FROM instagram_connections WHERE id = 1')
  const row = result.rows[0]
  if (!row) return null

  return {
    status: row.status,
    message: row.message,
    username: row.username,
    instagramAccountId: row.instagram_account_id,
    profilePictureUrl: row.profile_picture_url,
    facebookPageId: row.facebook_page_id,
    facebookPageName: row.facebook_page_name,
    pageAccessToken: maskSecret(row.page_access_token),
    userAccessToken: maskSecret(row.user_access_token),
    tokenType: row.token_type,
    expiresIn: row.expires_in,
    connectedAt: row.connected_at,
  }
}

async function saveConnectedAccount(account) {
  await pool.query(
    `INSERT INTO instagram_connections (
      id, status, message, username, instagram_account_id, profile_picture_url,
      facebook_page_id, facebook_page_name, page_access_token, user_access_token,
      token_type, expires_in, connected_at, updated_at
    )
    VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status,
      message = EXCLUDED.message,
      username = EXCLUDED.username,
      instagram_account_id = EXCLUDED.instagram_account_id,
      profile_picture_url = EXCLUDED.profile_picture_url,
      facebook_page_id = EXCLUDED.facebook_page_id,
      facebook_page_name = EXCLUDED.facebook_page_name,
      page_access_token = EXCLUDED.page_access_token,
      user_access_token = EXCLUDED.user_access_token,
      token_type = EXCLUDED.token_type,
      expires_in = EXCLUDED.expires_in,
      connected_at = EXCLUDED.connected_at,
      updated_at = EXCLUDED.updated_at`,
    [
      account.status,
      account.message,
      account.username,
      account.instagramAccountId,
      account.profilePictureUrl,
      account.facebookPageId,
      account.facebookPageName,
      account.pageAccessToken,
      account.userAccessToken,
      account.tokenType,
      account.expiresIn,
      account.connectedAt,
      nowIso(),
    ],
  )
}

function maskSecret(value) {
  if (!value) return ''
  if (value.length <= 8) return '***'
  return `${value.slice(0, 5)}...${value.slice(-4)}`
}

function toMinorUnits(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.round(parsed * 100)
}

function slugify(value) {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80) || 'product'
}
