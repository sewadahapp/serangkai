#!/usr/bin/env bash
#
# Verifies that the Docker image preserves the owner account, rangka,
# uploaded files, API tokens, and unlisted share links across container
# replacement on a volume mounted at /data.
#
# Usage:
#   scripts/verify-docker-persistence.sh
#
# The container runtime is auto-detected (podman, then docker) or set
# explicitly with SERANGKAI_CONTAINER_RUNTIME.
set -euo pipefail

RUNTIME="${SERANGKAI_CONTAINER_RUNTIME:-}"
if [ -z "$RUNTIME" ]; then
  RUNTIME="$(command -v podman || command -v docker || true)"
fi
if [ -z "$RUNTIME" ]; then
  echo "No container runtime found. Install podman or docker, or set SERANGKAI_CONTAINER_RUNTIME." >&2
  exit 127
fi

IMAGE="${SERANGKAI_TEST_IMAGE:-serangkai-persistence-test:local}"
VOLUME="${SERANGKAI_TEST_VOLUME:-serangkai-persistence-vol}"
CONTAINER="${SERANGKAI_TEST_CONTAINER:-serangkai-persistence-run}"
PORT="${SERANGKAI_TEST_PORT:-4488}"
BASE="http://127.0.0.1:${PORT}"

JWT_SECRET="$(head -c 40 /dev/urandom | xxd -p -c 64)"
SHARE_SECRET="$(head -c 40 /dev/urandom | xxd -p -c 64)"
OWNER_PASSWORD="correct horse battery"

workdir="$(mktemp -d)"

cleanup() {
  "$RUNTIME" rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap 'cleanup; rm -rf "$workdir"' EXIT

echo "==> Building $IMAGE with $RUNTIME"
"$RUNTIME" build -t "$IMAGE" "$(dirname "$0")/.." >/dev/null

"$RUNTIME" volume rm -f "$VOLUME" >/dev/null 2>&1 || true
"$RUNTIME" volume create "$VOLUME" >/dev/null

start() {
  cleanup
  "$RUNTIME" run -d --name "$CONTAINER" -p "${PORT}:3000" -v "${VOLUME}:/data" \
    -e NODE_ENV=production -e PORT=3000 -e HOST=0.0.0.0 \
    -e ADMIN_USERNAME=owner -e ADMIN_PASSWORD="$OWNER_PASSWORD" \
    -e JWT_SECRET="$JWT_SECRET" -e SHARE_SECRET="$SHARE_SECRET" \
    "$IMAGE" >/dev/null
  for _ in $(seq 1 120); do
    if curl -sf "$BASE/api/health" >/dev/null 2>&1; then return 0; fi
    sleep 0.5
  done
  echo "Container did not become healthy." >&2
  "$RUNTIME" logs "$CONTAINER" | tail -40 >&2
  return 1
}

login_cookie() {
  curl -sf -D - -o /dev/null -X POST "$BASE/api/auth/login" \
    -H 'content-type: application/json' \
    -d "{\"username\":\"owner\",\"password\":\"$OWNER_PASSWORD\"}" \
    | grep -i '^set-cookie' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1
}

fail() { echo "FAIL: $*" >&2; exit 1; }

echo "==> First container: create state"
start
HEALTH="$(curl -s "$BASE/api/health")"
echo "    health: $HEALTH"
COOKIE="$(login_cookie)"; [ -n "$COOKIE" ] || fail "login failed on first container"

RANGKA="$(curl -s -X POST "$BASE/api/rangka" -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"title":"Persisted report","type":"markdown","content":"# Persisted","visibility":"unlisted"}')"
RANGKA_ID="$(echo "$RANGKA" | sed 's/.*"id":"\([^"]*\)".*/\1/')"
[ -n "$RANGKA_ID" ] || fail "rangka creation failed: $RANGKA"

TOKEN="$(curl -s -X POST "$BASE/api/tokens" -H "cookie: $COOKIE" -H 'content-type: application/json' \
  -d '{"name":"persistence","scopes":["read","write"]}' | sed 's/.*"token":"\([^"]*\)".*/\1/')"
[ -n "$TOKEN" ] || fail "token creation failed"

printf '\x89PNG\r\n\x1a\n' > "$workdir/pixel.bin"
UPLOAD="$(curl -s -X POST "$BASE/api/rangka/upload" -H "cookie: $COOKIE" \
  -F "file=@$workdir/pixel.bin;type=image/png;filename=pixel.png" -F "title=Persisted image")"
UPLOAD_ID="$(echo "$UPLOAD" | sed 's/.*"id":"\([^"]*\)".*/\1/')"
[ -n "$UPLOAD_ID" ] || fail "upload failed: $UPLOAD"

SHARE_URL="$(curl -s -X POST "$BASE/api/rangka/$RANGKA_ID/share" -H "cookie: $COOKIE" | sed 's/.*"url":"\([^"]*\)".*/\1/')"
[ -n "$SHARE_URL" ] || fail "share link generation failed"

echo "==> Replacing the container (same volume)"
start

COOKIE2="$(login_cookie)"; [ -n "$COOKIE2" ] || fail "login failed after container replacement"

LIST="$(curl -s "$BASE/api/rangka" -H "cookie: $COOKIE2")"
echo "$LIST" | grep -q 'Persisted report' || fail "rangka did not survive"

curl -s -o "$workdir/pixel.out" -H "cookie: $COOKIE2" "$BASE/api/rangka/$UPLOAD_ID/download"
cmp -s "$workdir/pixel.bin" "$workdir/pixel.out" || fail "uploaded bytes did not survive"

TOKEN_STATUS="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/rangka" -H "authorization: Bearer $TOKEN")"
[ "$TOKEN_STATUS" = "200" ] || fail "API token stopped working (HTTP $TOKEN_STATUS)"

SHARE_STATUS="$(curl -s -o /dev/null -w '%{http_code}' "$SHARE_URL")"
[ "$SHARE_STATUS" = "200" ] || fail "unlisted share link stopped working (HTTP $SHARE_STATUS)"

echo "==> PASS: owner, rangka, uploads, tokens, and share links survived container replacement"
