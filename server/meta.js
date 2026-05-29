const GRAPH_BASE_URL = 'https://graph.facebook.com'

export function getMetaConfig() {
  return {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    accessToken: process.env.META_ACCESS_TOKEN || '',
    verifyToken: process.env.META_VERIFY_TOKEN || '',
    graphVersion: process.env.META_GRAPH_VERSION || 'v25.0',
    redirectUri: process.env.META_REDIRECT_URI || '',
    publicWebhookUrl: process.env.PUBLIC_WEBHOOK_URL || '',
    instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID || '',
    facebookPageId: process.env.FACEBOOK_PAGE_ID || '',
    businessId: process.env.META_BUSINESS_ID || '',
  }
}

export function getConfigStatus() {
  const config = getMetaConfig()
  const required = [
    'appId',
    'appSecret',
    'accessToken',
    'verifyToken',
    'redirectUri',
    'publicWebhookUrl',
    'instagramAccountId',
  ]

  return {
    connected: required.every((key) => Boolean(config[key])),
    graphVersion: config.graphVersion,
    webhookUrl: config.publicWebhookUrl,
    redirectUri: config.redirectUri,
    missing: required.filter((key) => !config[key]),
    ids: {
      appId: maskValue(config.appId),
      instagramAccountId: maskValue(config.instagramAccountId),
      facebookPageId: maskValue(config.facebookPageId),
      businessId: maskValue(config.businessId),
    },
  }
}

export function buildAuthUrl(state = 'linkplease_admin') {
  const config = getMetaConfig()
  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    state,
    scope: [
      'instagram_basic',
      'instagram_manage_messages',
      'instagram_manage_comments',
      'pages_show_list',
      'pages_manage_metadata',
      'pages_messaging',
    ].join(','),
  })

  return `${GRAPH_BASE_URL}/${config.graphVersion}/dialog/oauth?${params.toString()}`
}

export async function exchangeCodeForToken(code) {
  const config = getMetaConfig()
  const params = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code,
  })
  const response = await fetch(`${GRAPH_BASE_URL}/${config.graphVersion}/oauth/access_token?${params.toString()}`)
  return readMetaResponse(response)
}

export async function getConnectedInstagramAccounts(accessToken) {
  const config = getMetaConfig()
  const fields = [
    'id',
    'name',
    'access_token',
    'instagram_business_account{id,username,profile_picture_url}',
  ].join(',')
  const response = await fetch(
    `${GRAPH_BASE_URL}/${config.graphVersion}/me/accounts?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}`,
  )
  return readMetaResponse(response)
}

export async function sendInstagramTextMessage(recipientId, text) {
  const config = getMetaConfig()
  if (!config.accessToken || !config.instagramAccountId) {
    const missing = []
    if (!config.accessToken) missing.push('META_ACCESS_TOKEN')
    if (!config.instagramAccountId) missing.push('INSTAGRAM_ACCOUNT_ID')
    return {
      ok: false,
      skipped: true,
      message: `Missing ${missing.join(' and ')}. Add them on your live server first.`,
    }
  }

  const response = await fetch(
    `${GRAPH_BASE_URL}/${config.graphVersion}/${config.instagramAccountId}/messages?access_token=${encodeURIComponent(config.accessToken)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    },
  )

  return readMetaResponse(response)
}

async function readMetaResponse(response) {
  const payload = await response.json().catch(() => ({}))
  return {
    ok: response.ok,
    status: response.status,
    payload,
  }
}

function maskValue(value) {
  if (!value) return ''
  if (value.length <= 6) return '***'
  return `${value.slice(0, 4)}...${value.slice(-2)}`
}
