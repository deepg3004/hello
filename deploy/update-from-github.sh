#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/linkplease"

cd "$APP_DIR"
git pull origin main
npm install
npm run build
pm2 restart hello-invoxai
pm2 save

echo "Updated hello.invoxai.io from GitHub."
