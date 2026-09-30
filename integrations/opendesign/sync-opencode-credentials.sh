#!/usr/bin/env bash
#
# Sync the host OpenCode API-key credentials into the OpenDesign container's
# OpenCode database.
#
# Why this exists: OpenCode 2.x stores credentials in its SQLite database
# (`credential` table), not in `auth.json`. The container has its own database,
# so it does not inherit the host's providers even with `auth.json` mounted.
#
# Only rows labelled `API key` are copied. OAuth credentials are deliberately
# excluded: an OAuth refresh token that rotates would be invalidated for one of
# the two stores, breaking the host's own authentication.
#
# Re-run this whenever host credentials change.
#
# Usage: bash sync-opencode-credentials.sh
set -euo pipefail

HOST_DB="${HOME}/.local/share/opencode/opencode.db"
CONTAINER="${OPEN_DESIGN_CONTAINER:-open-design}"
CONTAINER_DB="/home/open-design/.local/share/opencode/opencode.db"
TMP_SQL="$(mktemp "${TMPDIR:-/tmp}/opencode-credentials.XXXXXX.sql")"
trap 'rm -f "$TMP_SQL"' EXIT

if [ ! -f "$HOST_DB" ]; then
  echo "host OpenCode database not found: $HOST_DB" >&2
  exit 1
fi

{
  echo "DELETE FROM credential WHERE label = 'API key';"
  sqlite3 "file:${HOST_DB}?mode=ro" ".mode insert credential" \
    "SELECT * FROM credential WHERE label = 'API key';"
} > "$TMP_SQL"

if ! grep -q '^INSERT INTO' "$TMP_SQL"; then
  echo "no API-key credentials found in the host database" >&2
  exit 1
fi

echo "syncing $(grep -c '^INSERT INTO' "$TMP_SQL") API-key credential(s) into ${CONTAINER}"

# The container's OpenCode must not hold the database while it is written.
# Stream SQL directly to stdin: never persist secret-bearing SQL in the container.
# The host mktemp file is private and the EXIT trap removes it even if apply fails.
docker exec -u 1000 -e HOME=/home/open-design "$CONTAINER" sh -c 'opencode service stop >/dev/null 2>&1 || true'
docker exec -i -u 1000 -e HOME=/home/open-design "$CONTAINER" sh -c "
  cd /app/apps/daemon && node -e \"
const fs = require('node:fs');
const Database = require('better-sqlite3');
const db = new Database('${CONTAINER_DB}');
db.exec('BEGIN');
db.exec(fs.readFileSync(0, 'utf8'));
db.exec('COMMIT');
console.log('credential rows now:', db.prepare('SELECT count(*) AS c FROM credential').get().c);
\"" < "$TMP_SQL"

echo "result:"
docker exec -u 1000 -e HOME=/home/open-design "$CONTAINER" sh -c 'opencode auth list 2>&1 | head -10'
