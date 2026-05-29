# Deploying InvoxAI to a Hostinger KVM VPS

Target stack: Ubuntu 22.04 LTS · Node 20 · Nginx · PM2 · Redis ·
Let's Encrypt. Domains: `invoxai.io`, `app.invoxai.io`,
`admin.invoxai.io`.

---

## 0. Prerequisites

- Hostinger KVM VPS, Ubuntu 22.04 LTS, root SSH access
- Domain `invoxai.io` controlled at your registrar
- Supabase project (URL, anon key, service role key)
- Razorpay account (KEY_ID, KEY_SECRET)
- Resend, MSG91 (optional at first)

---

## 1. Harden the VPS

SSH as root, create a non-root user, copy keys, enable firewall.

```bash
ssh root@YOUR_VPS_IP
adduser invox
usermod -aG sudo invox
rsync --archive --chown=invox:invox ~/.ssh /home/invox

apt update && apt upgrade -y
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

Re-login as `invox` from here on.

---

## 2. Install runtimes

```bash
# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Nginx + Certbot + Redis + Git
sudo apt install -y nginx certbot python3-certbot-nginx redis-server git
sudo systemctl enable --now redis-server

# PM2 — Next.js process manager
sudo npm install -g pm2
```

---

## 3. DNS

At your registrar, add A records:

| Type | Name  | Value         | TTL |
| ---- | ----- | ------------- | --- |
| A    | @     | YOUR_VPS_IP   | 300 |
| A    | www   | YOUR_VPS_IP   | 300 |
| A    | app   | YOUR_VPS_IP   | 300 |
| A    | admin | YOUR_VPS_IP   | 300 |

Verify before continuing:

```bash
dig +short invoxai.io app.invoxai.io admin.invoxai.io
```

---

## 4. Clone, configure, build

```bash
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/deepg3004/hello.git invoxai
cd invoxai
npm ci

nano .env.local        # paste real values — see below
npm run build
```

`.env.local` (real values, never commit):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
NEXT_PUBLIC_APP_URL=https://app.invoxai.io
RESEND_API_KEY=
MSG91_AUTH_KEY=
MSG91_SENDER_ID=INVOX
REDIS_URL=redis://127.0.0.1:6379
PLATFORM_COMMISSION_PERCENT=5
```

---

## 5. Run Next.js with PM2

```bash
cd ~/apps/invoxai
pm2 start npm --name invoxai -- start
pm2 save
pm2 startup systemd            # run the sudo command it prints
curl -I http://127.0.0.1:3000  # 200 OK
```

---

## 6. Nginx reverse proxy

`/etc/nginx/sites-available/invoxai`:

```nginx
server {
    listen 80;
    server_name invoxai.io www.invoxai.io;
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}

server {
    listen 80;
    server_name app.invoxai.io;
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}

server {
    listen 80;
    server_name admin.invoxai.io;
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/invoxai /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. SSL with Let's Encrypt

```bash
sudo certbot --nginx \
  -d invoxai.io -d www.invoxai.io \
  -d app.invoxai.io \
  -d admin.invoxai.io \
  --redirect --agree-tos -m you@yourmail.com --no-eff-email

sudo systemctl status certbot.timer    # auto-renew
```

---

## 8. Future deploys

Save once on the VPS:

```bash
cat > ~/deploy.sh <<'EOF'
#!/usr/bin/env bash
set -e
cd ~/apps/invoxai
git pull
npm ci
npm run build
pm2 reload invoxai
echo "deployed @ $(date)"
EOF
chmod +x ~/deploy.sh
```

From your laptop after any `git push`:

```bash
ssh invox@YOUR_VPS_IP '~/deploy.sh'
```

---

## 9. Webhook URLs

| Service              | URL                                                |
| -------------------- | -------------------------------------------------- |
| Razorpay             | `https://app.invoxai.io/api/webhooks/razorpay`     |
| Supabase auth cb     | `https://app.invoxai.io/auth/callback`             |
| Resend events (opt.) | `https://app.invoxai.io/api/webhooks/resend`       |

---

## 10. Health checks

```bash
pm2 logs invoxai --lines 50
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
sudo systemctl status nginx redis-server
redis-cli ping
df -h && free -h
```
