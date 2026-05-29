import crypto from 'node:crypto'

let razorpayClient = null
let razorpayLoadAttempted = false

export function isConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

export function publicKeyId() {
  return process.env.PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || ''
}

async function getClient() {
  if (!isConfigured()) return null
  if (razorpayClient) return razorpayClient
  if (razorpayLoadAttempted) return null
  razorpayLoadAttempted = true

  try {
    const { default: Razorpay } = await import('razorpay')
    razorpayClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
    return razorpayClient
  } catch (error) {
    console.warn('Razorpay SDK not installed or failed to load:', error.message)
    return null
  }
}

export async function createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
  const client = await getClient()
  if (!client) {
    return { ok: false, configured: false, message: 'Payments not configured.' }
  }

  try {
    const order = await client.orders.create({
      amount: Math.round(amount),
      currency,
      receipt: receipt?.slice(0, 40) || undefined,
      notes,
    })
    return { ok: true, order }
  } catch (error) {
    return { ok: false, configured: true, message: error?.error?.description || error.message }
  }
}

export function verifySignature({ orderId, paymentId, signature }) {
  if (!isConfigured()) return false
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')
  return expected === signature
}
