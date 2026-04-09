#!/bin/sh
set -eu

DB_FILE_PATH="${DB_FILE:-/data/mopay.sqlite}"
DB_DIR_PATH="$(dirname "$DB_FILE_PATH")"

ensure_db_writable_or_exit() {
  if [ ! -w "$DB_DIR_PATH" ]; then
    echo "ERROR: Database directory is not writable: $DB_DIR_PATH" >&2
    echo "Fix host permissions for bind mount (e.g. chown/chmod ./data) and restart container." >&2
    exit 70
  fi

  if [ -e "$DB_FILE_PATH" ] && [ ! -w "$DB_FILE_PATH" ]; then
    echo "ERROR: Database file is not writable: $DB_FILE_PATH" >&2
    echo "Fix host permissions for bind mount (e.g. chown/chmod ./data/mopay.sqlite) and restart container." >&2
    exit 70
  fi
}

if [ "$(id -u)" = "0" ]; then
  mkdir -p /data "$DB_DIR_PATH"
  # Compatibility with existing deployments that created /data as root.
  chown -R node:node /app /data 2>/dev/null || true
  chmod -R u+rwX /data 2>/dev/null || true
  ensure_db_writable_or_exit
  exec gosu node "$@"
fi

ensure_db_writable_or_exit
exec "$@"
