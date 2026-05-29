import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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
const dataDir = path.join(rootDir, 'server', 'data')
const connectionPath = path.join(dataDir, 'connected-instagram.json')

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: process.env.CORS_ORIGIN || true }))
app.use(express.json({ limit: '2mb' }))
app.use(morgan('dev'))

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'linkplease-live-backend',
    meta: getConfigStatus(),
  })
})

app.get('/api/instagram/connection', async (_request, response) => {
  response.json({
    ok: true,
    connectedAccount: await readConnectedAccount(),
  })
})

app.delete('/api/instagram/connection', async (_request, response) => {
  await fs.rm(connectionPath, { force: true })
  response.json({
    ok: true,
    message: 'Instagram account disconnected from this local dashboard.',
  })
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
    await handleAutomationEvent(event)
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

  const lowerText = event.text.toLowerCase()
  if (!lowerText.includes('guide') && !lowerText.includes('link')) return

  await sendInstagramTextMessage(
    event.senderId,
    'Thanks for your message. Here is your link: https://your-domain.com/product/creator-growth-playbook',
  )
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
  const data = await fs.readFile(connectionPath, 'utf8').catch(() => '')
  if (!data) return null

  try {
    const account = JSON.parse(data)
    return {
      ...account,
      pageAccessToken: maskSecret(account.pageAccessToken),
      userAccessToken: maskSecret(account.userAccessToken),
    }
  } catch {
    return null
  }
}

async function saveConnectedAccount(account) {
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(connectionPath, JSON.stringify(account, null, 2), 'utf8')
}

function maskSecret(value) {
  if (!value) return ''
  if (value.length <= 8) return '***'
  return `${value.slice(0, 5)}...${value.slice(-4)}`
}
