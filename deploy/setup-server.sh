#!/usr/bin/env bash
# =============================================================================
# InvoxAI — one-shot VPS bootstrapper.
#
# Run as root on a fresh Ubuntu 22.04 / 24.04 box:
#
#   curl -fsSL https://raw.githubusercontent.com/deepg3004/hello/main/deploy/setup-server.sh \
#     | sudo bash -s -- yourname@example.com
#
# Or, when checked out locally:
#
#   sudo bash deploy/setup-server.sh ops@invoxai.io
#
# The email is passed to certbot (for renewal notifications). It's optional —
# the script falls back to `--register-unsafely-without-email`.
# =============================================================================

set -euo pipefail

# ---- Tunables (override via env) -------------------------------------------
APP_USER="${APP_USER:-invoxai}"
APP_DIR="${APP_DIR:-/var/www/invoxai}"
REPO_URL="${REPO_URL:-https://github.com/deepg3004/hello.git}"
NODE_VERSION="${NODE_VERSION:-20}"
CERTBOT_EMAIL="${1:-${CERTBOT_EMAIL:-}}"

log()  { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }
note() { printf "  \033[2m%s\033[0m\n" "$*"; }

# ---- Hard pre-flight checks ------------------------------------------------
if [[ "${EUID}" -ne 0 ]]; then
  echo "Run me with sudo."
  exit 1
fi
if ! command -v lsb_release >/dev/null; then
  apt-get update -qq && apt-get install -y -qq lsb-release
fi
. /etc/os-release
if [[ "${ID:-}" != "ubuntu" ]]; then
  echo "This script targets Ubuntu (you're on ${ID:-unknown})."
  exit 1
fi

# ---- 1. Base packages ------------------------------------------------------
log "Updating apt + installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git build-essential pkg-config \
  ufw fail2ban software-properties-common \
  ca-certificates gnupg lsb-release jq cron unzip \
  redis-server postgresql-client \
  nginx \
  certbot python3-certbot-nginx python3-certbot-dns-cloudflare \
  chromium-browser fonts-noto-color-emoji libnss3 libxss1

# ---- 2. App user -----------------------------------------------------------
log "Creating service user ${APP_USER}"
if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${APP_USER}"
  usermod -aG sudo "${APP_USER}"
  # Allow passwordless sudo for app-control commands only — change as you see fit.
  install -m 440 /dev/null /etc/sudoers.d/${APP_USER}
  cat > /etc/sudoers.d/${APP_USER} <<EOF
${APP_USER} ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx, /bin/systemctl restart nginx, /bin/systemctl status nginx
EOF
fi
note "User ${APP_USER} ready"

# ---- 3. Node.js 20 via nvm -------------------------------------------------
log "Installing Node.js ${NODE_VERSION} via nvm"
sudo -u "${APP_USER}" -i bash <<EOF
set -euo pipefail
if [[ ! -d "\${HOME}/.nvm" ]]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
export NVM_DIR="\${HOME}/.nvm"
. "\${NVM_DIR}/nvm.sh"
nvm install ${NODE_VERSION}
nvm alias default ${NODE_VERSION}
nvm use default
npm install -g pm2
EOF
note "Node + PM2 installed for ${APP_USER}"

# ---- 4. PM2 systemd handover ----------------------------------------------
log "Wiring PM2 → systemd so the queue worker survives reboots"
APP_HOME=$(eval echo "~${APP_USER}")
NVM_NODE_BIN="${APP_HOME}/.nvm/versions/node/v$(sudo -u ${APP_USER} bash -lc 'node -v' | sed 's/v//')/bin"
env PATH="${PATH}:${NVM_NODE_BIN}" \
  "${NVM_NODE_BIN}/pm2" startup systemd -u "${APP_USER}" --hp "${APP_HOME}" >/dev/null || true

# ---- 5. Redis ---------------------------------------------------------------
log "Hardening Redis"
sed -i 's/^# *requirepass .*/# requirepass set via .env.production REDIS_URL/' /etc/redis/redis.conf
sed -i 's/^supervised .*/supervised systemd/' /etc/redis/redis.conf
systemctl enable redis-server >/dev/null
systemctl restart redis-server

# ---- 6. Firewall ------------------------------------------------------------
log "Configuring UFW"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
yes | ufw enable

# ---- 7. fail2ban ------------------------------------------------------------
log "Enabling fail2ban for SSH"
cat > /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled  = true
port     = ssh
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 5
bantime  = 3600
findtime = 600
EOF
systemctl enable fail2ban >/dev/null
systemctl restart fail2ban

# ---- 8. Repo checkout -------------------------------------------------------
log "Cloning the app into ${APP_DIR}"
mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
if [[ ! -d "${APP_DIR}/.git" ]]; then
  sudo -u "${APP_USER}" git clone "${REPO_URL}" "${APP_DIR}"
fi
note "Checkout at ${APP_DIR}"

# ---- 9. Nginx + Cloudflare DNS creds dir ------------------------------------
log "Installing the nginx vhost"
install -m 644 "${APP_DIR}/deploy/nginx/invoxai.conf" /etc/nginx/sites-available/invoxai
ln -sf /etc/nginx/sites-available/invoxai /etc/nginx/sites-enabled/invoxai
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

if [[ ! -f /etc/cloudflare.ini ]]; then
  log "Creating /etc/cloudflare.ini (stub) — edit with your token before requesting the wildcard cert"
  install -m 600 /dev/null /etc/cloudflare.ini
  cat > /etc/cloudflare.ini <<'EOF'
# Cloudflare API token with Zone:DNS:Edit + Zone:Zone:Read on invoxai.io
# Replace and chmod 600.
dns_cloudflare_api_token = YOUR_TOKEN_HERE
EOF
fi

# ---- 10. Backup cron --------------------------------------------------------
log "Installing the nightly backup cron at 02:00"
install -m 755 "${APP_DIR}/deploy/backup-supabase.sh" /usr/local/bin/invoxai-backup
cat > /etc/cron.d/invoxai-backup <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 2 * * * ${APP_USER} /usr/local/bin/invoxai-backup >> /var/log/invoxai-backup.log 2>&1
EOF
touch /var/log/invoxai-backup.log
chown "${APP_USER}:${APP_USER}" /var/log/invoxai-backup.log

# ---- 11. PM2 deploy helper --------------------------------------------------
log "Installing /home/${APP_USER}/deploy.sh"
sudo -u "${APP_USER}" bash <<EOF
set -euo pipefail
cat > "\${HOME}/deploy.sh" <<'INNER'
#!/usr/bin/env bash
set -euo pipefail
cd /var/www/invoxai
git pull --ff-only origin main
. "\${HOME}/.nvm/nvm.sh"
nvm use default
npm ci --omit=dev || npm ci
npm run build
pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js
pm2 save
INNER
chmod +x "\${HOME}/deploy.sh"
EOF

# ---- 12. Wrap-up ------------------------------------------------------------
log "Done. Next steps:"
note "1. Copy .env.production into ${APP_DIR}/.env.production (chmod 600)"
note "2. Run the first deploy as ${APP_USER}:"
note "     sudo -i -u ${APP_USER} ~/deploy.sh"
note "3. Request certificates:"
if [[ -n "${CERTBOT_EMAIL}" ]]; then
note "     certbot --nginx -d hello.invoxai.io --email ${CERTBOT_EMAIL} --agree-tos --redirect -n"
note "     certbot certonly --dns-cloudflare --dns-cloudflare-credentials /etc/cloudflare.ini --email ${CERTBOT_EMAIL} --agree-tos -d '*.invoxai.io' -d invoxai.io -n"
else
note "     certbot --nginx -d hello.invoxai.io --register-unsafely-without-email --agree-tos --redirect -n"
note "     certbot certonly --dns-cloudflare --dns-cloudflare-credentials /etc/cloudflare.ini --register-unsafely-without-email --agree-tos -d '*.invoxai.io' -d invoxai.io -n"
fi
note "4. systemctl reload nginx"
