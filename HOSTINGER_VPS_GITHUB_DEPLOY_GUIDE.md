# Hostinger VPS + GitHub Deployment Guide

This guide is for deploying this LinkPlease-style Instagram DM automation app on a Hostinger VPS and connecting the project to a GitHub repository.

Official Hostinger references used:

- Hostinger VPS SSH guide: https://www.hostinger.com/support/5723772-how-to-connect-to-your-vps-via-ssh-at-hostinger/
- Hostinger Node.js VPS support note: https://support.hostinger.com/en/articles/1583661-is-node-js-supported-at-hostinger
- Hostinger Git deployment guide: https://www.hostinger.com/support/1583302-how-to-deploy-a-git-repository-in-hostinger
- Hostinger VPS setup guide: https://www.hostinger.com/tutorials/how-to-set-up-vps

## 1. What You Need

Prepare these details first:

```text
Hostinger VPS IP address
Hostinger VPS root password or SSH key
Domain name
GitHub repository URL
Meta App ID
Meta App Secret
Meta Verify Token
Meta Access Token
Instagram Account ID
Facebook Page ID
Meta Business ID
```

Example GitHub repo URL:

```text
https://github.com/deepg3004/hello.git
```

## 2. Connect To Hostinger VPS

From your computer terminal:

```bash
ssh root@YOUR_VPS_IP
```

Example:

```bash
ssh root@123.45.67.89
```

If Hostinger gives you a username other than `root`, use that username.

## 3. Update Server

Run this on the VPS:

```bash
apt update
```

Install basic tools:

```bash
apt install -y git curl nginx ufw
```

Because this VPS already hosts other websites, do not delete or replace existing Nginx files. This project only needs a new server block for:

```text
hello.invoxai.io
```

The app uses internal port `8080` by default. Before installing, check whether another app already uses that port:

```bash
ss -ltnp | grep ':8080'
```

If nothing appears, port `8080` is free. If something appears, change this project to another port such as `8081`:

```env
PORT=8081
```

Then update the Nginx proxy line:

```nginx
proxy_pass http://127.0.0.1:8081;
```

## 3A. Faster One-Command Project Setup

After connecting to the VPS, you can run the project setup script instead of copying every command manually:

```bash
apt update && apt install -y git
mkdir -p /var/www
cd /var/www
git clone https://github.com/deepg3004/hello.git linkplease
cd linkplease
bash deploy/hostinger-vps-setup.sh
```

The script creates only this Nginx site:

```text
/etc/nginx/sites-available/hello-invoxai
```

It does not remove your other websites.

Then edit your real credentials:

```bash
nano /var/www/linkplease/.env
pm2 restart hello-invoxai
```

Manual steps are still listed below if you prefer doing each part yourself.

## 4. Install Node.js

Use Node.js 22 LTS or newer.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
npm -v
```

## 5. Install PM2

PM2 keeps the Node backend running.

```bash
npm install -g pm2
```

## 6. Clone GitHub Repo On VPS

Go to web folder:

```bash
mkdir -p /var/www
cd /var/www
```

Clone your repo:

```bash
git clone https://github.com/deepg3004/hello.git linkplease
cd linkplease
```

Install dependencies:

```bash
npm install
```

Build frontend:

```bash
npm run build
```

## 7. Create Environment File

Create `.env`:

```bash
nano .env
```

Paste this and replace values:

```env
PORT=8080
CORS_ORIGIN=https://hello.invoxai.io
ADMIN_SETUP_KEY=create_a_private_admin_setup_password
DATABASE_URL=postgresql://postgres.YOUR_PROJECT_REF:YOUR_DB_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres

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

Save and close:

```text
CTRL + O
ENTER
CTRL + X
```

## 7A. Database Setup (Supabase Postgres)

This app uses Supabase (hosted PostgreSQL). The VPS only runs the Node app and Nginx — the database lives in Supabase.

Full step-by-step guide is in `SUPABASE_SETUP.md`. Short version:

1. Create a Supabase project at https://supabase.com (region: closest to your VPS).
2. In Supabase → **SQL Editor**, paste the contents of `server/schema.sql` and click **Run**.
3. In Supabase → **Project Settings → Database → Connection string**, copy the **Transaction pooler** URL (port 6543).
4. On the VPS, put it in `.env` as `DATABASE_URL=...`.
5. (Optional) Restrict access to only your VPS IP under **Project Settings → Database → Network Restrictions**.

Tables created by `schema.sql`:

```text
instagram_connections
automations
contacts
messages
products
orders
```

Backups are automatic in Supabase (daily on Free plan, point-in-time recovery on Pro).

## 8. Start App With PM2

From project folder:

```bash
pm2 startOrReload ecosystem.config.cjs
pm2 save
pm2 startup
```

PM2 may print one command. Copy that command and run it.

Check app:

```bash
pm2 status
pm2 logs hello-invoxai
curl http://127.0.0.1:8080/api/health
```

## 9. Configure Nginx

Create Nginx config:

```bash
nano /etc/nginx/sites-available/hello-invoxai
```

Paste:

```nginx
server {
    listen 80;
    server_name hello.invoxai.io www.hello.invoxai.io;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:

```bash
ln -s /etc/nginx/sites-available/hello-invoxai /etc/nginx/sites-enabled/hello-invoxai
nginx -t
systemctl reload nginx
```

## 10. Point Domain To VPS

In Hostinger DNS:

```text
Type: A
Name: @
Value: YOUR_VPS_IP
TTL: default
```

For `www`:

```text
Type: A
Name: www
Value: YOUR_VPS_IP
TTL: default
```

Wait for DNS propagation.

## 11. Install SSL

Install Certbot:

```bash
apt install -y certbot python3-certbot-nginx
```

Create SSL:

```bash
certbot --nginx -d hello.invoxai.io -d www.hello.invoxai.io
```

Test:

```bash
certbot renew --dry-run
```

## 12. Meta App URLs

In Meta Developer Dashboard, set:

```text
OAuth Redirect URI:
https://hello.invoxai.io/auth/meta/callback

Webhook Callback URL:
https://hello.invoxai.io/api/webhooks/instagram

Webhook Verify Token:
same value as META_VERIFY_TOKEN
```

Test webhook:

```bash
curl "https://hello.invoxai.io/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=12345"
```

Expected:

```text
12345
```

## 13. User Instagram Connect Flow

After deployment:

1. User opens `https://hello.invoxai.io`.
2. User clicks **Connect Instagram Account**.
3. Meta login opens.
4. User approves permissions.
5. Meta redirects to `/auth/meta/callback`.
6. Backend saves connected Instagram/Page details.
7. Dashboard shows the connected Instagram account in **Settings > Instagram**.

## 14. Admin Setup Flow

Open:

```text
https://hello.invoxai.io
```

Go to **Admin Dashboard**.

Fill:

```text
Admin Setup Key
Meta App ID
Meta App Secret
Access Token
Webhook Verify Token
Webhook Callback URL
OAuth Redirect URI
Graph API Version
Instagram Account ID
Facebook Page ID
Meta Business ID
```

Click:

```text
Sync To Backend
```

Then restart app:

```bash
pm2 restart hello-invoxai
```

## 15. Update App From GitHub

When new code is pushed:

```bash
cd /var/www/linkplease
git pull origin main
npm install
npm run build
pm2 restart hello-invoxai
```

Or run the included update script:

```bash
bash /var/www/linkplease/deploy/update-from-github.sh
```

If your branch is `master`, use:

```bash
git pull origin master
```

## 16. Push Local Project To GitHub

Run this from your local project folder:

```bash
git init
git add .
git commit -m "Initial LinkPlease SaaS prototype"
git branch -M main
git remote add origin https://github.com/deepg3004/hello.git
git push -u origin main
```

If the GitHub repo already exists and has files, first run:

```bash
git pull origin main --allow-unrelated-histories
```

Then resolve conflicts if any, commit, and push again.

## 17. Important Security Rules

Never push this file:

```text
.env
```

This project already ignores `.env`.

Never expose these values in frontend code:

```text
META_APP_SECRET
META_ACCESS_TOKEN
ADMIN_SETUP_KEY
```

For production, protect the Admin Dashboard with real login before giving access to users.

## 18. Common Commands

Check app:

```bash
pm2 status
```

View logs:

```bash
pm2 logs hello-invoxai
```

Restart app:

```bash
pm2 restart hello-invoxai
```

Restart Nginx:

```bash
systemctl restart nginx
```

Check Nginx config:

```bash
nginx -t
```

Check backend:

```bash
curl http://127.0.0.1:8080/api/health
```

Check public site:

```bash
curl https://hello.invoxai.io/api/health
```

