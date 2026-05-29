/**
 * Transactional email service for LinkPlease.
 *
 * Provider auto-detection (Gmail preferred for Workspace inboxes):
 *   1. GMAIL_USER + GMAIL_APP_PASSWORD → Gmail via nodemailer
 *   2. RESEND_API_KEY                  → Resend HTTPS API
 *   3. Neither                         → no-op + console log
 *
 * Public surface (export):
 *   • EmailError                    typed error
 *   • isGmailConfigured()           bool
 *   • isResendConfigured()          bool
 *   • isEmailConfigured()           bool
 *   • emailProviderName()           'gmail' | 'resend' | null
 *   • sendOrderEmail(order)         spec-shape sender (id, items[], totals)
 *   • sendWelcomeEmail(user)        triggered after first IG connection
 *   • sendOrderConfirmation(...)    legacy alias used by /api/public/orders/verify
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const RETRY_DELAYS_MS = [1000, 2000, 4000]

let nodemailerTransporter = null
let nodemailerLoadAttempted = false

export class EmailError extends Error {
  constructor(message, { provider, attempts, cause } = {}) {
    super(message)
    this.name = 'EmailError'
    this.provider = provider || emailProviderName()
    this.attempts = attempts || 0
    this.cause = cause
  }
}

export function isGmailConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY)
}

export function isEmailConfigured() {
  return isGmailConfigured() || isResendConfigured()
}

export function emailProviderName() {
  if (isGmailConfigured()) return 'gmail'
  if (isResendConfigured()) return 'resend'
  return null
}

function fromAddress() {
  if (isGmailConfigured()) {
    return process.env.GMAIL_FROM || process.env.GMAIL_USER
  }
  return process.env.RESEND_FROM_EMAIL || 'orders@invoxai.io'
}

async function getGmailTransporter() {
  if (!isGmailConfigured()) return null
  if (nodemailerTransporter) return nodemailerTransporter
  if (nodemailerLoadAttempted) return null
  nodemailerLoadAttempted = true
  try {
    const { default: nodemailer } = await import('nodemailer')
    nodemailerTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    })
    return nodemailerTransporter
  } catch (error) {
    console.warn('nodemailer not installed or failed to load:', error.message)
    return null
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withRetry(attempt) {
  let lastError = null
  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    try {
      const result = await attempt(i + 1)
      if (result?.ok) return { ...result, attempts: i + 1 }
      lastError = new Error(result?.error || result?.message || 'Send failed')
    } catch (err) {
      lastError = err
    }
    if (i < RETRY_DELAYS_MS.length) {
      await delay(RETRY_DELAYS_MS[i])
    }
  }
  throw new EmailError('All retries exhausted', {
    attempts: RETRY_DELAYS_MS.length + 1,
    cause: lastError,
  })
}

async function sendViaGmail({ to, subject, html, text }) {
  const transport = await getGmailTransporter()
  if (!transport) return { ok: false, error: 'Gmail not configured' }
  try {
    const info = await transport.sendMail({
      from: fromAddress(), to, subject, html, text,
    })
    return { ok: true, via: 'gmail', messageId: info.messageId }
  } catch (error) {
    return { ok: false, via: 'gmail', error: error.message }
  }
}

async function sendViaResend({ to, subject, html, text }) {
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [to],
        subject,
        html,
        ...(text ? { text } : null),
      }),
    })
    const payload = await response.json().catch(() => ({}))
    return { ok: response.ok, via: 'resend', status: response.status, payload }
  } catch (error) {
    return { ok: false, via: 'resend', error: error.message }
  }
}

async function send({ to, subject, html, text }) {
  if (!to) throw new EmailError('No recipient email')
  const provider = emailProviderName()
  if (!provider) {
    console.log(`[email] No provider configured — would send "${subject}" to ${to}`)
    return { ok: false, skipped: true }
  }
  return withRetry(async () => {
    if (provider === 'gmail') {
      const result = await sendViaGmail({ to, subject, html, text })
      if (result.ok) return result
      if (isResendConfigured()) return sendViaResend({ to, subject, html, text })
      return result
    }
    return sendViaResend({ to, subject, html, text })
  })
}

/* ---------- public senders ---------- */

/**
 * Send an order confirmation email to the buyer.
 * Accepts the new spec shape (id, items[], totals) or the legacy shape.
 *
 * @param {{
 *   id: string|number,
 *   customer_name?: string,
 *   customer_email: string,
 *   amount: number,
 *   currency?: string,
 *   items?: Array<{title: string, quantity?: number, unitPrice: number}>,
 *   resourceLink?: string,
 *   accentColor?: string,
 *   created_at?: string,
 * }} order
 */
export async function sendOrderEmail(order) {
  const currency = order.currency || 'INR'
  const html = orderHtml(order, currency)
  const text = orderText(order, currency)
  const subject = `Your order #${order.id || ''} is confirmed — LinkPlease`
  try {
    return await send({ to: order.customer_email, subject, html, text })
  } catch (error) {
    if (error instanceof EmailError) throw error
    throw new EmailError('Order email send failed', { cause: error })
  }
}

/**
 * Legacy alias used by the existing /api/public/orders/verify path.
 * Accepts the shape we've been using since Phase 1.
 *
 * @param {{ to: string, productName: string, amount: number, currency?: string,
 *           resourceLink?: string, accentColor?: string }} args
 */
export async function sendOrderConfirmation({ to, productName, amount, currency, resourceLink, accentColor }) {
  return sendOrderEmail({
    id: '',
    customer_email: to,
    amount,
    currency,
    items: [{ title: productName, quantity: 1, unitPrice: amount }],
    resourceLink,
    accentColor,
  }).catch((error) => {
    if (error instanceof EmailError) return { ok: false, skipped: false, error: error.message }
    return { ok: false, error: error.message }
  })
}

/**
 * Welcome email sent after a user first connects their Instagram account.
 *
 * @param {{ email: string, displayName?: string, dashboardUrl?: string }} user
 */
export async function sendWelcomeEmail(user) {
  if (!user?.email) throw new EmailError('No recipient email')
  const html = welcomeHtml(user)
  const text = welcomeText(user)
  try {
    return await send({
      to: user.email,
      subject: 'Welcome to LinkPlease — your Instagram is connected 🎉',
      html, text,
    })
  } catch (error) {
    if (error instanceof EmailError) throw error
    throw new EmailError('Welcome email send failed', { cause: error })
  }
}

/* ---------- templates ---------- */

function formatMoney(minor, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format((minor || 0) / 100)
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function orderHtml(order, currency) {
  const accent = order.accentColor || '#6366f1'
  const support = process.env.SUPPORT_EMAIL || fromAddress()
  const itemsArr = Array.isArray(order.items) ? order.items : []
  const rows = itemsArr.length
    ? itemsArr.map((it) => `
        <tr>
          <td style="padding:10px 12px;font-size:13px;color:#0f172a">${escapeHtml(it.title)}</td>
          <td style="padding:10px 12px;font-size:13px;color:#0f172a;text-align:center">${it.quantity || 1}</td>
          <td style="padding:10px 12px;font-size:13px;color:#0f172a;text-align:right">${formatMoney(it.unitPrice, currency)}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="padding:10px 12px;font-size:13px;color:#64748b">Order #${escapeHtml(order.id || '')}</td></tr>`
  const cta = order.resourceLink
    ? `<a href="${escapeHtml(order.resourceLink)}" style="display:inline-block;padding:14px 28px;background:${accent};color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600">Access your product →</a>`
    : ''
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 8px 24px rgba(15,23,42,0.06)">
    <div style="width:56px;height:56px;border-radius:50%;background:${accent};color:#ffffff;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px">✓</div>
    <h1 style="text-align:center;font-size:22px;margin:0 0 4px">Payment confirmed</h1>
    <p style="text-align:center;color:#64748b;margin:0 0 24px">Order #${escapeHtml(order.id || '')} — ${formatMoney(order.amount, currency)}</p>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:16px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;letter-spacing:0.06em">PRODUCT</th>
        <th style="padding:10px 12px;text-align:center;font-size:11px;color:#64748b;letter-spacing:0.06em">QTY</th>
        <th style="padding:10px 12px;text-align:right;font-size:11px;color:#64748b;letter-spacing:0.06em">PRICE</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#f8fafc">
        <td colspan="2" style="padding:12px;font-weight:700">Total</td>
        <td style="padding:12px;font-weight:700;text-align:right">${formatMoney(order.amount, currency)}</td>
      </tr></tfoot>
    </table>
    ${cta ? `<div style="text-align:center;margin:24px 0">${cta}</div>` : ''}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
    <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0">
      Need help? <a href="mailto:${escapeHtml(support)}" style="color:${accent}">${escapeHtml(support)}</a>
    </p>
  </div>
</body></html>`
}

function orderText(order, currency) {
  const itemsArr = Array.isArray(order.items) ? order.items : []
  const lines = [
    `Payment confirmed — Order #${order.id || ''}`,
    `Total: ${formatMoney(order.amount, currency)}`,
    '',
    'Items:',
    ...itemsArr.map((it) => `  - ${it.title} (x${it.quantity || 1}) — ${formatMoney(it.unitPrice, currency)}`),
  ]
  if (order.resourceLink) lines.push('', `Access your product: ${order.resourceLink}`)
  lines.push('', '— LinkPlease (built on InvoxAI)')
  return lines.join('\n')
}

function welcomeHtml(user) {
  const name = escapeHtml(user.displayName || 'creator')
  const dashboard = user.dashboardUrl || 'https://hello.invoxai.io/dashboard/overview'
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 8px 24px rgba(15,23,42,0.06)">
    <h1 style="font-size:22px;margin:0 0 8px">Welcome, ${name} 🎉</h1>
    <p style="color:#64748b;margin:0 0 16px">Your Instagram is now connected. From here you can build automations, sell products, and track everything from one dashboard.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${escapeHtml(dashboard)}" style="display:inline-block;padding:14px 28px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600">Open dashboard →</a>
    </div>
    <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0">— Built on InvoxAI</p>
  </div>
</body></html>`
}

function welcomeText(user) {
  const name = user.displayName || 'creator'
  const dashboard = user.dashboardUrl || 'https://hello.invoxai.io/dashboard/overview'
  return [
    `Welcome, ${name}!`,
    '',
    'Your Instagram is now connected.',
    'Open your dashboard: ' + dashboard,
    '',
    '— Built on InvoxAI',
  ].join('\n')
}
