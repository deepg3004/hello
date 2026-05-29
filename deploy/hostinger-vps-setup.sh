#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/linkplease"
REPO_URL="https://github.com/deepg3004/hello.git"
DOMAIN="hello.invoxai.io"
APP_NAME="hello-invoxai"

echo "Updating server packages..."
apt update && apt upgrade -y
apt install -y git curl nginx ufw

if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing PM2..."
  npm install -g pm2
fi

mkdir -p /var/www

if [ -d "$APP_DIR/.git" ]; then
  echo "Updating existing app..."
  cd "$APP_DIR"
  git pull origin main
else
  echo "Cloning app..."
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

npm install
npm run build

if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo "Created .env from .env.example. Edit it before going live:"
  echo "nano $APP_DIR/.env"
fi

pm2 startOrReload ecosystem.config.cjs
pm2 save

cp "$APP_DIR/deploy/nginx-hello.invoxai.io.conf" /etc/nginx/sites-available/hello-invoxai
ln -sf /etc/nginx/sites-available/hello-invoxai /etc/nginx/sites-enabled/hello-invoxai
nginx -t
systemctl reload nginx

echo "Base deployment complete."
echo "Next:"
echo "1. Edit secrets: nano $APP_DIR/.env"
echo "2. Restart app: pm2 restart $APP_NAME"
echo "3. Point DNS A record for $DOMAIN to this VPS IP."
echo "4. Install SSL: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
