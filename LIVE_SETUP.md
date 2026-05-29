# LinkPlease Live Server Setup

This project now has a React dashboard and a Node backend for Meta Instagram setup.

## 1. Install And Build

```bash
npm install
npm run build
npm start
```

The live backend serves both:

- Dashboard: `https://hello.invoxai.io`
- API: `https://hello.invoxai.io/api/...`

## 2. Add Server Environment Variables

Copy `.env.example` to `.env` on your server and fill your real values.

```env
PORT=8080
CORS_ORIGIN=https://hello.invoxai.io
ADMIN_SETUP_KEY=create_a_private_admin_setup_password
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_ACCESS_TOKEN=your_long_lived_page_or_instagram_token
META_VERIFY_TOKEN=create_a_strong_random_verify_token
META_GRAPH_VERSION=v25.0
META_REDIRECT_URI=https://hello.invoxai.io/auth/meta/callback
PUBLIC_WEBHOOK_URL=https://hello.invoxai.io/api/webhooks/instagram
INSTAGRAM_ACCOUNT_ID=your_instagram_business_or_creator_account_id
FACEBOOK_PAGE_ID=your_connected_facebook_page_id
META_BUSINESS_ID=your_meta_business_id
```

Never put `META_APP_SECRET` or long-lived access tokens in frontend code.

You can also open the dashboard, go to **Admin Dashboard**, fill the same values, enter your `ADMIN_SETUP_KEY`, and click **Sync To Backend**. This writes the values into `.env` on servers where the app has file-write access. Restart the backend after changing live credentials.

## 3. Meta Developer App Setup

1. Go to Meta for Developers.
2. Create a new app.
3. Add Instagram / Messenger API products.
4. Add your live domain in app settings.
5. Add privacy policy URL.
6. Add data deletion URL.
7. Add OAuth redirect URL:

```text
https://hello.invoxai.io/auth/meta/callback
```

## 3A. User Connect Flow

After Admin setup is complete, normal users connect like this:

1. User opens your website.
2. User clicks **Connect Instagram Account** on the Home page or Settings page.
3. Your app opens:

```text
https://hello.invoxai.io/auth/meta
```

4. Meta login opens and the user approves permissions.
5. Meta redirects back to:

```text
https://hello.invoxai.io/auth/meta/callback
```

6. The backend exchanges the code for a token.
7. The backend fetches the connected Facebook Page and Instagram Professional account.
8. The dashboard shows the connected Instagram handle in **Settings > Instagram**.

For local development, the connect button calls:

```text
http://127.0.0.1:8080/auth/meta
```

For live hosting, the same button calls:

```text
https://hello.invoxai.io/auth/meta
```

## 4. Instagram Requirements

1. Use an Instagram Professional account.
2. Connect it to a Facebook Page.
3. Make sure your Facebook user is admin of the Page.
4. Add the Instagram account as a tester while the Meta app is in development mode.

## 5. Webhook Setup

In Meta dashboard, add this callback URL:

```text
https://hello.invoxai.io/api/webhooks/instagram
```

Use the same value from `META_VERIFY_TOKEN` as the verify token.

Subscribe to these event fields:

- `messages`
- `messaging_postbacks`
- `messaging_seen`
- `message_reactions`
- `comments`
- `live_comments`

## 6. Test The Backend

Health check:

```bash
curl https://hello.invoxai.io/api/health
```

Webhook verification test:

```bash
curl "https://hello.invoxai.io/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=12345"
```

Expected response:

```text
12345
```

Send message test:

```bash
curl -X POST https://hello.invoxai.io/api/messages/send \
  -H "Content-Type: application/json" \
  -d "{\"recipientId\":\"IG_USER_ID\",\"text\":\"Hello from LinkPlease\"}"
```

This only works after Meta permissions and tokens are valid.

## 7. App Review

Submit Meta App Review for the permissions your use case needs:

- `instagram_basic`
- `instagram_manage_messages`
- `instagram_manage_comments`
- `pages_show_list`
- `pages_manage_metadata`
- `pages_messaging`

Prepare a screen recording showing:

1. User connects Instagram.
2. Your app receives webhook events.
3. Your app sends a permitted DM reply.
4. User can disconnect or manage the connection.

## 8. Go Live

After approval:

1. Switch Meta app to Live mode.
2. Confirm `/api/health` shows no missing Meta fields.
3. Send a real test DM/comment from another account.
4. Confirm webhook logs appear on server.
5. Confirm automation reply is sent.

## Current Backend Routes

- `GET /api/health`
- `GET /api/instagram/connection`
- `DELETE /api/instagram/connection`
- `GET /auth/meta`
- `GET /auth/meta/callback`
- `GET /api/webhooks/instagram`
- `POST /api/webhooks/instagram`
- `POST /api/messages/send`

