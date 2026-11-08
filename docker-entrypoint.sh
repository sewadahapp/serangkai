#!/bin/sh
set -eu

# The image runs as the unprivileged `bun` user, while named volumes are
# commonly created as root. Prepare every configured persistent location (the
# defaults point at /data) and fail with an actionable message if the mount is
# missing or read-only.
DATA_ROOT="${SERANGKAI_DATA_ROOT:-/data}"
DATABASE_FILE="${DATABASE_PATH:-$DATA_ROOT/serangkai.db}"
STORAGE_DIR="${STORAGE_PATH:-$DATA_ROOT/files}"

case "$DATABASE_FILE" in
  /*) DATABASE_DIR=$(dirname "$DATABASE_FILE") ;;
  *) DATABASE_DIR=$(dirname "/app/$DATABASE_FILE") ;;
esac

case "$STORAGE_DIR" in
  /*) STORAGE_ABS="$STORAGE_DIR" ;;
  *) STORAGE_ABS="/app/$STORAGE_DIR" ;;
esac

if ! mkdir -p "$DATABASE_DIR" "$STORAGE_ABS"; then
  echo "[serangkai] Could not create persistent directories:" >&2
  echo "  database: $DATABASE_DIR" >&2
  echo "  storage:  $STORAGE_ABS" >&2
  echo "Mount a writable volume at /data (or set DATABASE_PATH/STORAGE_PATH)." >&2
  exit 1
fi

chown -R bun:bun "$DATABASE_DIR" "$STORAGE_ABS" 2>/dev/null || true

if ! su bun -s /bin/sh -c "test -w '$DATABASE_DIR' && test -w '$STORAGE_ABS'"; then
  echo "[serangkai] The persistent directories are not writable by the bun user:" >&2
  echo "  database: $DATABASE_DIR" >&2
  echo "  storage:  $STORAGE_ABS" >&2
  echo "Check the volume mount and permissions, then restart the container." >&2
  exit 1
fi

exec su bun -s /bin/sh -c 'exec bun /app/scripts/start.mjs'
