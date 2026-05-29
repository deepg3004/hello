/**
 * Email module with two providers:
 *   1. Gmail SMTP via nodemailer  (preferred — GMAIL_USER + GMAIL_APP_PASSWORD)
 *   2. Resend HTTPS API           (fallback — RESEND_API_KEY)
 *
 * If neither is configured, sendOrderConfirmation logs and no-ops.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

let nodemailerTransporter = null
let nodemailerLoadAttempted = false

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

async function getGmailTransporter() {
  if (!isGmailConfigured()) return null
  if (nodemailerTransporter) return nodemailerTransporter
  if (nodemailerLoadAttempted) return null
  nodemailerLoadAttempted = true

  try {
    const { default: nodemailer } = await import('nodemailer')
    nodemailerTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
    return nodemailerTransporter
  } catch (error) {
    console.warn('nodemailer not installed or failed to load:', error.message)
    return null
  }
}

function fromAddress() {
  if (isGmailConfigured()) {
    return process.env.GMAIL_FROM || process.env.GMAIL_USER
  }
  return process.env.RESEND_FROM_EMAIL || 'orders@invoxai.io'
}

export async function sendOrderConfirmation({ to, productName, amount, currency, resourceLink, accentColor }) {
  if (!to) return { ok: false, message: 'No recipient email.' }

  const subject = `Your ${productName} is ready`
  const html = orderConfirmationTemplate({
    productName,
    amount,
    currency,
    resourceLink,
    accentColor: accentColor || '#6366f1',
  })

  const gmail = await getGmailTransporter()
  if (gmail) {
    try {
      const info = await gmail.sendMail({
        from: fromAddress(),
        to,
        subject,
        html,
      })
      return { ok: true, via: 'gmail', messageId: info.messageId }
    } catch (error) {
      console.warn('Gmail send failed:', error.message)
      // fall through to Resend if configured
    }
  }

  if (isResendConfigured()) {
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
        }),
      })
      const payload = await response.json().catch(() => ({}))
      return { ok: response.ok, via: 'resend', status: response.status, payload }
    } catch (error) {
      return { ok: false, via: 'resend', error: error.message }
    }
  }

  console.log(`[email] No provider configured. Would email ${to} (${productName} ${currency} ${amount / 100})`)
  return { ok: false, skipped: true }
}

function orderConfirmationTemplate({ productName, amount, currency, resourceLink, accentColor }) {
  const formattedAmount = new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format((amount || 0) / 100)
  const cta = resourceLink
    ? `<a href="${escapeHtml(resourceLink)}" style="display:inline-block;padding:14px 28px;background:${accentColor};color:#0f172a;text-decoration:none;border-radius:10px;font-weight:600">Access your product →</a>`
    : '<p style="color:#64748b">The seller will reach out with delivery instructions shortly.</p>'

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,system-ui,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 8px 24px rgba(15,23,42,0.06)">
    <div style="width:56px;height:56px;border-radius:50%;background:${accentColor};display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:28px">✓</div>
    <h1 style="text-align:center;font-size:22px;margin:0 0 8px;color:#0f172a">Payment confirmed</h1>
    <p style="text-align:center;color:#64748b;margin:0 0 24px">${escapeHtml(productName)} — ${formattedAmount}</p>
    <div style="text-align:center;margin:24px 0">${cta}</div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
    <p style="font-size:12px;color:#94a3b8;text-align:center;margin:0">Sent from InvoxAI · Need help? Reply to this email.</p>
  </div>
</body></html>`
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
