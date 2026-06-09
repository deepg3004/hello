#!/usr/bin/env bash
# Fires a single InvoxAI cron endpoint with the shared secret. Invoked from the
# system crontab so the secret lives in .env.production (root-only) instead of
# being inlined in `crontab -l`. Usage: cron-hit.sh <endpoint-path>
#   e.g. cron-hit.sh sequences  →  POST /api/cron/sequences
set -euo pipefail

cd /var/www/invoxai
set -a; . ./.env.production; set +a

endpoint="${1:?usage: cron-hit.sh <endpoint-path>}"
base="${NEXT_PUBLIC_APP_URL:-https://app.invoxai.io}"

curl -fsS -X POST \
  -H "x-cron-secret: ${CRON_SECRET}" \
  "${base}/api/cron/${endpoint}"
