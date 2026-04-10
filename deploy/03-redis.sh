#!/usr/bin/env bash
# Task 3 — Store REDIS_URL in Secret Manager (Upstash recommended).
# Depends on: 01-gcp-setup.sh
#
# Usage (Upstash / any external Redis):
#   PROJECT_ID=skynet-messaging REDIS_URL="rediss://..." bash deploy/03-redis.sh
#
# For Upstash: create a free database at https://upstash.com, copy the
# "rediss://" connection URL, and pass it as REDIS_URL.

set -euo pipefail
source "$(dirname "$0")/config.sh"

REDIS_URL="${REDIS_URL:?Set REDIS_URL before running this script (e.g. rediss://user:pass@host:port)}"

echo "==> Storing REDIS_URL in Secret Manager..."
if gcloud secrets describe REDIS_URL --project="${PROJECT_ID}" &>/dev/null; then
  echo -n "${REDIS_URL}" | gcloud secrets versions add REDIS_URL \
    --data-file=- \
    --project="${PROJECT_ID}"
  echo "  Added new version to existing secret."
else
  echo -n "${REDIS_URL}" | gcloud secrets create REDIS_URL \
    --data-file=- \
    --project="${PROJECT_ID}"
  echo "  Created new secret."
fi

echo ""
echo "Done. Secret REDIS_URL stored in Secret Manager."
