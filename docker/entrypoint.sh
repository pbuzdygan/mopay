#!/bin/sh
set -eu

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
export PUID PGID

validate_id() {
  case "$2" in
    ''|0*|*[!0-9]*) valid=false ;;
    *)
      valid=false
      if [ "${#2}" -le 10 ] && [ "$2" -le 2147483647 ]; then
        valid=true
      fi
      ;;
  esac
  if [ "$valid" != true ]; then
    echo "ERROR: $1 must be a decimal ID between 1 and 2147483647 (root is not allowed)." >&2
    exit 64
  fi
}
validate_id PUID "$PUID"
validate_id PGID "$PGID"

# Keep the backend's actual default aligned with the storage permission check.
export DB_FILE="${DB_FILE:-/data/mopay.sqlite}"
DB_FILE_PATH="$(node /app/runtimeConfig.js)"
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
  # Repair only persistent storage, never application code or arbitrary DB paths.
  if ! mkdir -p /data || ! chown -R "$PUID:$PGID" /data || ! chmod -R u+rwX /data; then
    echo "ERROR: Cannot prepare /data for PUID/PGID. Fix mount ownership/permissions or start with the configured non-root user." >&2
    exit 70
  fi
  # Re-enter as the selected identity to check access without root privileges.
  exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups "$0" "$@"
fi

if [ "$(id -u)" != "$PUID" ] || [ "$(id -g)" != "$PGID" ]; then
  echo "ERROR: Container user must match PUID=$PUID and PGID=$PGID. Adjust user or environment configuration." >&2
  exit 64
fi
if [ ! -d "$DB_DIR_PATH" ] && ! mkdir -p "$DB_DIR_PATH"; then
  echo "ERROR: Cannot create database directory as PUID/PGID. Prepare a writable DB_FILE directory and restart." >&2
  exit 70
fi
ensure_db_writable_or_exit
exec "$@"
