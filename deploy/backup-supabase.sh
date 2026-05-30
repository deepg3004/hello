#!/usr/bin/env bash
# =============================================================================
# Nightly Supabase Postgres backup.
#
# Cron (installed by setup-server.sh):
#   0 2 * * * invoxai /usr/local/bin/invoxai-backup
#
# What it does:
#   1. pg_dump the entire Supabase DB to a gzipped file in /tmp
#   2. Upload to Supabase Storage at  ${SUPABASE_BACKUPS_BUCKET}/YYYY/MM/dump-YYYY-MM-DD.sql.gz
#   3. Prune dumps older than SUPABASE_BACKUP_RETENTION_DAYS (default 30)
# =============================================================================

set -euo pipefail

# Load .env.production so we see SUPABASE_DB_URL + service-role key etc.
ENV_FILE="${ENV_FILE:-/var/www/invoxai/.env.production}"
if [[ -f "${ENV_FILE}" ]]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +o allexport
fi

BUCKET="${SUPABASE_BACKUPS_BUCKET:-backups}"
RETAIN_DAYS="${SUPABASE_BACKUP_RETENTION_DAYS:-30}"

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "[backup] SUPABASE_DB_URL not set — aborting" >&2
  exit 1
fi
if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "[backup] Supabase URL or service-role key missing — aborting" >&2
  exit 1
fi

STAMP="$(date -u +%Y-%m-%d)"
YEAR="$(date -u +%Y)"
MONTH="$(date -u +%m)"
TMPDIR="$(mktemp -d -t invoxai-backup-XXXX)"
trap 'rm -rf "${TMPDIR}"' EXIT
OUT="${TMPDIR}/dump-${STAMP}.sql.gz"

echo "[backup] running pg_dump → ${OUT}"
pg_dump \
  --no-owner --no-privileges \
  --quote-all-identifiers \
  --format=plain \
  "${SUPABASE_DB_URL}" \
  | gzip -9 > "${OUT}"

SIZE=$(stat -c '%s' "${OUT}")
echo "[backup] dump complete (${SIZE} bytes)"

# Upload to Supabase Storage (POST against the storage REST API).
DEST_PATH="${YEAR}/${MONTH}/dump-${STAMP}.sql.gz"
UPLOAD_URL="${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${DEST_PATH}"
echo "[backup] uploading to ${UPLOAD_URL}"
HTTP=$(curl --silent --show-error --write-out '%{http_code}' --output /dev/null \
  --request POST \
  --header "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  --header "x-upsert: true" \
  --header "Content-Type: application/gzip" \
  --data-binary "@${OUT}" \
  "${UPLOAD_URL}")
if [[ "${HTTP}" != "200" && "${HTTP}" != "201" ]]; then
  echo "[backup] upload failed (HTTP ${HTTP})" >&2
  exit 2
fi
echo "[backup] upload ok"

# Prune anything older than RETAIN_DAYS via the storage REST list+delete.
CUT="$(date -u -d "${RETAIN_DAYS} days ago" +%Y-%m-%d)"
echo "[backup] pruning dumps before ${CUT}"
LIST_RESP=$(curl --silent --request POST \
  --header "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  --header "Content-Type: application/json" \
  --data "{\"prefix\":\"\",\"limit\":1000,\"sortBy\":{\"column\":\"name\",\"order\":\"asc\"}}" \
  "${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/${BUCKET}")
# Old dumps have name = YYYY/MM/dump-YYYY-MM-DD.sql.gz — extract anything <= CUT.
OLD=$(echo "${LIST_RESP}" | jq -r --arg cut "${CUT}" '
  .[]?
  | select((.name // "") | test("dump-[0-9]{4}-[0-9]{2}-[0-9]{2}\\.sql\\.gz$"))
  | select(.name | capture("dump-(?<d>[0-9]{4}-[0-9]{2}-[0-9]{2})").d <= $cut)
  | .name')
if [[ -z "${OLD}" ]]; then
  echo "[backup] nothing to prune"
  exit 0
fi
while IFS= read -r name; do
  [[ -z "${name}" ]] && continue
  echo "[backup] deleting ${name}"
  curl --silent --request DELETE \
    --header "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    "${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}" \
    > /dev/null
done <<< "${OLD}"

echo "[backup] done at $(date -u)"
