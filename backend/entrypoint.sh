#!/bin/sh
set -e

if [ -z "$MOPAY_PIN" ]; then
  echo "ERROR: MOPAY_PIN is not set. Provide a PIN of at least 8 characters via docker-compose or env." >&2
  exit 1
fi

if [ ${#MOPAY_PIN} -lt 8 ]; then
  echo "ERROR: MOPAY_PIN must be at least 8 characters long." >&2
  exit 1
fi

mkdir -p /app/data
exec gunicorn -b 0.0.0.0:8000 app.app:app --workers 2
