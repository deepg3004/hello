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
import {
  createOrder as createRazorpayOrder,
  isConfigured as isRazorpayConfigured,
  publicKeyId as razorpayPublicKeyId,
  verifySignature as verifyRazorpaySignature,
} from './payments.js'
import {
  emailProviderName,
  isEmailConfigured,
  sendOrderConfirmation,
  sendWelcomeEmail,
} from './services/email.js'

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
    triggerKeyword = '',
    matchType = 'contains',
  } = request.body || {}

  try {
    const result = await pool.query(
      `INSERT INTO automations (
         name, trigger, opening_message, cta_label, cta_url, status,
         trigger_keyword, match_type, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING *`,
      [name, trigger, openingMessage, ctaLabel, ctaUrl, status, triggerKeyword, matchType, timestamp],
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

app.delete('/api/automations/:id', async (request, response) => {
  try {
    const result = await pool.query(
      'DELETE FROM automations WHERE id = $1 RETURNING id',
      [request.params.id],
    )
    if (!result.rowCount) {
      response.status(404).json({ ok: false, message: 'Automation not found.' })
      return
    }
    response.json({ ok: true })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.get('/api/messages', async (request, response) => {
  const limit = Math.min(Number(request.query.limit) || 10, 100)
  try {
    const result = await pool.query(
      `SELECT m.id, m.instagram_user_id, m.direction, m.body, m.event_type, m.created_at,
              c.handle, c.name
       FROM messages m
       LEFT JOIN contacts c ON c.id = m.contact_id
       ORDER BY m.created_at DESC
       LIMIT $1`,
      [limit],
    )
    response.json({ ok: true, messages: result.rows })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.get('/api/analytics/revenue', async (request, response) => {
  const days = Math.min(Number(request.query.days) || 7, 90)
  try {
    const result = await pool.query(
      `SELECT date_trunc('day', created_at) AS day,
              SUM(amount) AS revenue,
              COUNT(*) AS orders
       FROM orders
       WHERE status = 'paid' AND created_at >= NOW() - ($1 || ' days')::interval
       GROUP BY 1 ORDER BY 1`,
      [days],
    )
    response.json({
      ok: true,
      days: result.rows.map((r) => ({
        day: r.day,
        revenue: Number(r.revenue) || 0,
        orders: Number(r.orders) || 0,
      })),
    })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.post('/api/analytics/click', async (request, response) => {
  const { linkId } = request.body || {}
  if (!linkId) {
    response.status(400).json({ ok: false, message: 'linkId is required.' })
    return
  }
  const ip = request.headers['x-forwarded-for']?.split(',')[0] || request.ip
  try {
    await pool.query(
      `INSERT INTO link_clicks (link_id, profile_id, ip_addr, user_agent, referer)
       SELECT $1, profile_id, $2, $3, $4 FROM profile_links WHERE id = $1`,
      [linkId, ip, request.headers['user-agent'] || '', request.headers.referer || ''],
    )
    await pool.query('UPDATE profile_links SET click_count = click_count + 1 WHERE id = $1', [linkId])
    response.json({ ok: true })
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

  const sections = safeJson(body.sections, {
    gallery: false, testimonials: false, faq: false, aboutMe: false, showcase: false,
  })
  const published = body.published === true || body.published === 'true'

  try {
    const result = await pool.query(
      `INSERT INTO products (
        name, slug, description, seller_name, seller_email, cover_image, button_text,
        pricing_mode, suggested_price, accent_color, theme, resource_link, settings_json,
        price, currency, payments_enabled,
        sections, gallery, testimonials, faq, about_me, showcase_product_ids,
        custom_questions, terms_text, refund_text, privacy_text, meta_pixel_id, ga_tracking_id,
        published, published_at, theme_preset, stock_limit,
        created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$33)
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
        JSON.stringify(sections),
        JSON.stringify(Array.isArray(body.gallery) ? body.gallery : []),
        JSON.stringify(Array.isArray(body.testimonials) ? body.testimonials : []),
        JSON.stringify(Array.isArray(body.faq) ? body.faq : []),
        body.aboutMe || '',
        JSON.stringify(Array.isArray(body.showcaseProductIds) ? body.showcaseProductIds : []),
        JSON.stringify(Array.isArray(body.customQuestions) ? body.customQuestions : []),
        body.termsText || '',
        body.refundText || '',
        body.privacyText || '',
        body.metaPixelId || '',
        body.gaTrackingId || '',
        published,
        published ? timestamp : null,
        body.themePreset || 'aurora',
        body.stockLimit ? Number(body.stockLimit) : null,
        timestamp,
      ],
    )
    response.status(201).json({ ok: true, product: result.rows[0] })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.patch('/api/products/:id/publish', async (request, response) => {
  const published = request.body?.published !== false
  try {
    const result = await pool.query(
      `UPDATE products SET published = $1, published_at = $2, updated_at = $3 WHERE id = $4 RETURNING *`,
      [published, published ? nowIso() : null, nowIso(), request.params.id],
    )
    if (!result.rowCount) {
      response.status(404).json({ ok: false, message: 'Product not found.' })
      return
    }
    response.json({ ok: true, product: result.rows[0] })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.post('/api/products/:id/duplicate', async (request, response) => {
  try {
    const sourceResult = await pool.query('SELECT * FROM products WHERE id = $1', [request.params.id])
    const source = sourceResult.rows[0]
    if (!source) {
      response.status(404).json({ ok: false, message: 'Product not found.' })
      return
    }
    const timestamp = nowIso()
    const newSlug = `${source.slug || 'product'}-copy-${Date.now().toString().slice(-5)}`
    const result = await pool.query(
      `INSERT INTO products (
        name, slug, description, seller_name, seller_email, cover_image, button_text,
        pricing_mode, suggested_price, accent_color, theme, resource_link, settings_json,
        price, currency, payments_enabled,
        sections, gallery, testimonials, faq, about_me, showcase_product_ids,
        custom_questions, terms_text, refund_text, privacy_text, meta_pixel_id, ga_tracking_id,
        published, published_at, theme_preset, stock_limit,
        created_at, updated_at
      )
      SELECT
        name || ' (Copy)', $1, description, seller_name, seller_email, cover_image, button_text,
        pricing_mode, suggested_price, accent_color, theme, resource_link, settings_json,
        price, currency, payments_enabled,
        sections, gallery, testimonials, faq, about_me, showcase_product_ids,
        custom_questions, terms_text, refund_text, privacy_text, meta_pixel_id, ga_tracking_id,
        false, NULL, theme_preset, stock_limit,
        $2, $2
      FROM products WHERE id = $3
      RETURNING *`,
      [newSlug, timestamp, request.params.id],
    )
    response.status(201).json({ ok: true, product: result.rows[0] })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.patch('/api/products/:id', async (request, response) => {
  const body = request.body || {}
  const timestamp = nowIso()
  const fieldMap = {
    title: { col: 'name', value: body.title },
    name: { col: 'name', value: body.name },
    slug: { col: 'slug', value: body.slug ? slugify(body.slug) : undefined },
    description: { col: 'description', value: body.description },
    sellerName: { col: 'seller_name', value: body.sellerName },
    sellerEmail: { col: 'seller_email', value: body.sellerEmail },
    coverImage: { col: 'cover_image', value: body.coverImage },
    buttonText: { col: 'button_text', value: body.buttonText },
    pricingMode: { col: 'pricing_mode', value: body.pricingMode },
    accent: { col: 'accent_color', value: body.accent },
    theme: { col: 'theme', value: body.theme },
    themePreset: { col: 'theme_preset', value: body.themePreset },
    resourceLink: { col: 'resource_link', value: body.resourceLink },
    currency: { col: 'currency', value: body.currency },
    aboutMe: { col: 'about_me', value: body.aboutMe },
    termsText: { col: 'terms_text', value: body.termsText },
    refundText: { col: 'refund_text', value: body.refundText },
    privacyText: { col: 'privacy_text', value: body.privacyText },
    metaPixelId: { col: 'meta_pixel_id', value: body.metaPixelId },
    gaTrackingId: { col: 'ga_tracking_id', value: body.gaTrackingId },
    stockLimit: { col: 'stock_limit', value: body.stockLimit === '' ? null : (body.stockLimit != null ? Number(body.stockLimit) : undefined) },
  }

  const sets = []
  const params = []
  let i = 1

  for (const key in fieldMap) {
    const { col, value } = fieldMap[key]
    if (value !== undefined) {
      sets.push(`${col} = $${i++}`)
      params.push(value)
    }
  }
  if (body.minimumPrice !== undefined || body.price !== undefined) {
    sets.push(`price = $${i++}`)
    params.push(toMinorUnits(body.minimumPrice ?? body.price))
  }
  if (body.suggestedPrice !== undefined) {
    sets.push(`suggested_price = $${i++}`)
    params.push(toMinorUnits(body.suggestedPrice))
  }
  for (const [key, col] of [
    ['sections', 'sections'],
    ['gallery', 'gallery'],
    ['testimonials', 'testimonials'],
    ['faq', 'faq'],
    ['showcaseProductIds', 'showcase_product_ids'],
    ['customQuestions', 'custom_questions'],
  ]) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${i++}`)
      params.push(JSON.stringify(body[key]))
    }
  }

  if (!sets.length) {
    response.status(400).json({ ok: false, message: 'No fields to update.' })
    return
  }

  sets.push(`updated_at = $${i++}`)
  params.push(timestamp)
  params.push(request.params.id)

  try {
    const result = await pool.query(
      `UPDATE products SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    )
    if (!result.rowCount) {
      response.status(404).json({ ok: false, message: 'Product not found.' })
      return
    }
    response.json({ ok: true, product: result.rows[0] })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.get('/api/public/config', (_request, response) => {
  response.json({
    ok: true,
    razorpay: {
      configured: isRazorpayConfigured(),
      keyId: razorpayPublicKeyId(),
    },
    email: {
      configured: isEmailConfigured(),
      provider: emailProviderName(),
    },
  })
})

// ===== Linktree-style creator profile =====

app.get('/api/public/profiles/:handle', async (request, response) => {
  try {
    const profileResult = await pool.query(
      `SELECT id, handle, display_name, bio, avatar_url, instagram_url, twitter_url,
              youtube_url, whatsapp_url, primary_color, meta_pixel_id, ga_tracking_id, view_count
       FROM creator_profiles
       WHERE handle = $1 AND is_published = true LIMIT 1`,
      [request.params.handle.toLowerCase()],
    )
    const profile = profileResult.rows[0]
    if (!profile) {
      response.status(404).json({ ok: false, message: 'Profile not found.' })
      return
    }

    const linksResult = await pool.query(
      `SELECT id, title, subtitle, url, price_minor, currency, position
       FROM profile_links
       WHERE profile_id = $1 AND is_visible = true
       ORDER BY position, id`,
      [profile.id],
    )

    pool.query('UPDATE creator_profiles SET view_count = view_count + 1 WHERE id = $1', [profile.id])
      .catch(() => {})

    response.json({ ok: true, profile, links: linksResult.rows })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.post('/api/payments/create-order', async (request, response) => {
  // Alias for spec compatibility — delegates to public orders endpoint shape
  const { amount, currency = 'INR', notes = {} } = request.body || {}
  if (!amount || amount <= 0) {
    response.status(400).json({ ok: false, message: 'amount is required and must be > 0' })
    return
  }
  if (!isRazorpayConfigured()) {
    response.status(503).json({ ok: false, configured: false, message: 'Payments not configured.' })
    return
  }
  const orderResult = await createRazorpayOrder({
    amount: Math.round(amount * 100),
    currency,
    receipt: `quick-${Date.now()}`,
    notes,
  })
  if (!orderResult.ok) {
    response.status(502).json({ ok: false, message: orderResult.message })
    return
  }
  response.json({
    ok: true,
    razorpayOrderId: orderResult.order.id,
    amount: orderResult.order.amount,
    currency: orderResult.order.currency,
    keyId: razorpayPublicKeyId(),
  })
})

// ===== Profile management (admin) =====

app.get('/api/profiles/me', async (_request, response) => {
  try {
    const result = await pool.query(
      `SELECT id, handle, display_name, bio, avatar_url, instagram_url, twitter_url,
              youtube_url, whatsapp_url, primary_color, meta_pixel_id, ga_tracking_id,
              is_published, view_count
       FROM creator_profiles ORDER BY id LIMIT 1`,
    )
    response.json({ ok: true, profile: result.rows[0] || null })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.put('/api/profiles/me', async (request, response) => {
  const body = request.body || {}
  const handle = (body.handle || '').toLowerCase().replace(/[^a-z0-9_-]/g, '')
  if (!handle) {
    response.status(400).json({ ok: false, message: 'handle is required (a-z, 0-9, _ , - only)' })
    return
  }
  try {
    const existing = await pool.query('SELECT id FROM creator_profiles ORDER BY id LIMIT 1')
    if (existing.rowCount) {
      const updated = await pool.query(
        `UPDATE creator_profiles SET
          handle = $1, display_name = $2, bio = $3, avatar_url = $4,
          instagram_url = $5, twitter_url = $6, youtube_url = $7, whatsapp_url = $8,
          primary_color = $9, meta_pixel_id = $10, ga_tracking_id = $11,
          is_published = $12, updated_at = NOW()
         WHERE id = $13 RETURNING *`,
        [handle, body.displayName || '', body.bio || '', body.avatarUrl || '',
         body.instagramUrl || '', body.twitterUrl || '', body.youtubeUrl || '', body.whatsappUrl || '',
         body.primaryColor || '#7c3aed', body.metaPixelId || '', body.gaTrackingId || '',
         body.isPublished !== false, existing.rows[0].id],
      )
      response.json({ ok: true, profile: updated.rows[0] })
    } else {
      const created = await pool.query(
        `INSERT INTO creator_profiles
          (handle, display_name, bio, avatar_url, instagram_url, twitter_url, youtube_url,
           whatsapp_url, primary_color, meta_pixel_id, ga_tracking_id, is_published)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [handle, body.displayName || '', body.bio || '', body.avatarUrl || '',
         body.instagramUrl || '', body.twitterUrl || '', body.youtubeUrl || '', body.whatsappUrl || '',
         body.primaryColor || '#7c3aed', body.metaPixelId || '', body.gaTrackingId || '',
         body.isPublished !== false],
      )
      response.status(201).json({ ok: true, profile: created.rows[0] })
    }
  } catch (error) {
    if (error.code === '23505') {
      response.status(409).json({ ok: false, message: 'That handle is already taken.' })
      return
    }
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.get('/api/profiles/me/links', async (_request, response) => {
  try {
    const profile = await pool.query('SELECT id FROM creator_profiles ORDER BY id LIMIT 1')
    if (!profile.rowCount) {
      response.json({ ok: true, links: [] })
      return
    }
    const result = await pool.query(
      'SELECT * FROM profile_links WHERE profile_id = $1 ORDER BY position, id',
      [profile.rows[0].id],
    )
    response.json({ ok: true, links: result.rows })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.post('/api/profiles/me/links', async (request, response) => {
  const body = request.body || {}
  if (!body.title || !body.url) {
    response.status(400).json({ ok: false, message: 'title and url are required' })
    return
  }
  try {
    const profile = await pool.query('SELECT id FROM creator_profiles ORDER BY id LIMIT 1')
    if (!profile.rowCount) {
      response.status(400).json({ ok: false, message: 'Create your profile first.' })
      return
    }
    const next = await pool.query(
      'SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM profile_links WHERE profile_id = $1',
      [profile.rows[0].id],
    )
    const result = await pool.query(
      `INSERT INTO profile_links (profile_id, title, subtitle, url, price_minor, currency, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [profile.rows[0].id, body.title, body.subtitle || '', body.url,
       body.priceMinor || null, body.currency || 'INR', next.rows[0].pos],
    )
    response.status(201).json({ ok: true, link: result.rows[0] })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.patch('/api/profiles/me/links/:id', async (request, response) => {
  const body = request.body || {}
  const sets = []
  const params = []
  let i = 1
  for (const [key, col] of [
    ['title', 'title'], ['subtitle', 'subtitle'], ['url', 'url'],
    ['priceMinor', 'price_minor'], ['currency', 'currency'],
    ['position', 'position'], ['isVisible', 'is_visible'],
  ]) {
    if (body[key] !== undefined) {
      sets.push(`${col} = $${i++}`)
      params.push(body[key])
    }
  }
  if (!sets.length) {
    response.status(400).json({ ok: false, message: 'No fields to update.' })
    return
  }
  params.push(request.params.id)
  try {
    const result = await pool.query(
      `UPDATE profile_links SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      params,
    )
    if (!result.rowCount) {
      response.status(404).json({ ok: false, message: 'Link not found.' })
      return
    }
    response.json({ ok: true, link: result.rows[0] })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.delete('/api/profiles/me/links/:id', async (request, response) => {
  try {
    const result = await pool.query('DELETE FROM profile_links WHERE id = $1 RETURNING id', [request.params.id])
    if (!result.rowCount) {
      response.status(404).json({ ok: false, message: 'Link not found.' })
      return
    }
    response.json({ ok: true })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.get('/api/public/products/:slug', async (request, response) => {
  try {
    const result = await pool.query(
      `SELECT
        id, name, slug, description, cover_image, button_text, pricing_mode,
        price, suggested_price, currency, accent_color, theme, theme_preset,
        sections, gallery, testimonials, faq, about_me, showcase_product_ids,
        custom_questions, terms_text, refund_text, privacy_text,
        meta_pixel_id, ga_tracking_id, seller_name, published, view_count, stock_limit
      FROM products WHERE slug = $1 LIMIT 1`,
      [request.params.slug],
    )
    const product = result.rows[0]
    if (!product || !product.published) {
      response.status(404).json({ ok: false, message: 'Product not found.' })
      return
    }
    response.json({ ok: true, product })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.post('/api/public/products/:slug/view', async (request, response) => {
  try {
    await pool.query(
      "UPDATE products SET view_count = view_count + 1 WHERE slug = $1 AND published = true",
      [request.params.slug],
    )
    response.json({ ok: true })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.post('/api/public/orders', async (request, response) => {
  const { slug, email, phone, price, customAnswers } = request.body || {}

  if (!slug || !email) {
    response.status(400).json({ ok: false, message: 'slug and email are required.' })
    return
  }

  const productResult = await pool.query(
    'SELECT id, name, price, currency, pricing_mode, suggested_price FROM products WHERE slug = $1 LIMIT 1',
    [slug],
  )
  const product = productResult.rows[0]
  if (!product) {
    response.status(404).json({ ok: false, message: 'Product not found.' })
    return
  }

  const requestedMinor = toMinorUnits(price)
  const minimumMinor = product.price || 0
  const chargeMinor = product.pricing_mode === 'fixed'
    ? minimumMinor
    : Math.max(requestedMinor, minimumMinor)

  if (chargeMinor <= 0) {
    response.status(400).json({ ok: false, message: 'Price must be greater than zero.' })
    return
  }

  if (!isRazorpayConfigured()) {
    response.status(503).json({
      ok: false,
      configured: false,
      message: 'Payments coming soon — Razorpay keys not configured on the server yet.',
    })
    return
  }

  const orderResult = await createRazorpayOrder({
    amount: chargeMinor,
    currency: product.currency || 'INR',
    receipt: `lp-${product.id}-${Date.now()}`,
    notes: { productId: String(product.id), email },
  })

  if (!orderResult.ok) {
    response.status(502).json({
      ok: false,
      configured: orderResult.configured ?? true,
      message: orderResult.message || 'Could not create order.',
    })
    return
  }

  try {
    await pool.query(
      `INSERT INTO orders (
        customer_email, product_name, product_id, amount, payout_amount, currency,
        razorpay_order_id, status, phone, custom_answers, created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10)`,
      [
        email,
        product.name,
        product.id,
        chargeMinor,
        Math.round(chargeMinor * 0.9),
        product.currency || 'INR',
        orderResult.order.id,
        phone || '',
        JSON.stringify(customAnswers || {}),
        nowIso(),
      ],
    )
  } catch (error) {
    console.error('Order insert failed:', error.message)
  }

  response.json({
    ok: true,
    razorpayOrderId: orderResult.order.id,
    amount: orderResult.order.amount,
    currency: orderResult.order.currency,
    keyId: razorpayPublicKeyId(),
    productName: product.name,
  })
})

app.post('/api/public/orders/verify', async (request, response) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = request.body || {}

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    response.status(400).json({ ok: false, message: 'Missing Razorpay fields.' })
    return
  }

  const valid = verifyRazorpaySignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  })

  if (!valid) {
    await pool.query(
      "UPDATE orders SET status = 'failed' WHERE razorpay_order_id = $1",
      [razorpayOrderId],
    ).catch(() => {})
    response.status(400).json({ ok: false, message: 'Invalid Razorpay signature.' })
    return
  }

  try {
    const updated = await pool.query(
      `UPDATE orders
       SET status = 'paid', razorpay_payment_id = $1, razorpay_signature = $2
       WHERE razorpay_order_id = $3
       RETURNING customer_email, product_name, product_id, amount, currency`,
      [razorpayPaymentId, razorpaySignature, razorpayOrderId],
    )

    const order = updated.rows[0]
    if (order) {
      let resourceLink = ''
      let accentColor = '#6366f1'
      if (order.product_id) {
        const productLookup = await pool.query(
          'SELECT resource_link, accent_color FROM products WHERE id = $1',
          [order.product_id],
        )
        resourceLink = productLookup.rows[0]?.resource_link || ''
        accentColor = productLookup.rows[0]?.accent_color || accentColor
      }
      sendOrderConfirmation({
        to: order.customer_email,
        productName: order.product_name,
        amount: order.amount,
        currency: order.currency,
        resourceLink,
        accentColor,
      }).catch((err) => console.error('Order email failed:', err.message))
    }

    response.json({ ok: true })
  } catch (error) {
    response.status(500).json({ ok: false, message: error.message })
  }
})

app.delete('/api/products/:id', async (request, response) => {
  try {
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [request.params.id],
    )
    if (!result.rowCount) {
      response.status(404).json({ ok: false, message: 'Product not found.' })
      return
    }
    response.json({ ok: true, deletedId: result.rows[0].id })
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

let cachedIndexHtml = null
async function loadIndexHtml() {
  if (cachedIndexHtml) return cachedIndexHtml
  cachedIndexHtml = await fs.readFile(path.join(distDir, 'index.html'), 'utf8').catch(() => '')
  return cachedIndexHtml
}

app.get('/p/:slug', async (request, response, next) => {
  try {
    const html = await loadIndexHtml()
    if (!html) return next()

    const productResult = await pool.query(
      `SELECT name, description, cover_image, seller_name FROM products
       WHERE slug = $1 AND published = true LIMIT 1`,
      [request.params.slug],
    )
    const product = productResult.rows[0]

    const escape = (value) =>
      String(value || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

    const fullUrl = `${request.protocol}://${request.get('host')}${request.originalUrl}`
    const title = product ? `${product.name} — InvoxAI` : 'Page not found — InvoxAI'
    const description = product?.description?.slice(0, 200) || 'Discover digital products from creators.'
    const image = product?.cover_image || ''

    const ogTags = `
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    <meta property="og:type" content="product" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:url" content="${escape(fullUrl)}" />
    ${image ? `<meta property="og:image" content="${escape(image)}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(title)}" />
    <meta name="twitter:description" content="${escape(description)}" />
    ${image ? `<meta name="twitter:image" content="${escape(image)}" />` : ''}
  `

    const injected = html.replace('</head>', `${ogTags}</head>`)
    response.setHeader('Content-Type', 'text/html; charset=utf-8')
    response.send(injected)
  } catch (error) {
    console.error('OG inject failed:', error.message)
    next()
  }
})

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

function safeJson(value, fallback) {
  if (value && typeof value === 'object') return value
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return fallback }
  }
  return fallback
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
