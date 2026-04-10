#!/usr/bin/env bash
# Task 5 — Run DB migrations (Cloud Run Job) then deploy the API service.
# Depends on: 02-cloudsql.sh, 03-redis.sh, 04-push-images.sh
#
# Usage:
#   PROJECT_ID=skynet-messaging \
#   INSTANCE_CONNECTION_NAME=skynet-messaging:europe-west1:messaging-db \
#     bash deploy/05-deploy-api.sh

set -euo pipefail
source "$(dirname "$0")/config.sh"

# ── 5a: Create / update the migration job and run it ─────────────────────────
echo "==> Creating Cloud Run Job for DB migrations..."
gcloud run jobs create messaging-migrate \
  --image="${API_IMAGE}" \
  --region="${REGION}" \
  --service-account="${SA_EMAIL}" \
  --add-cloudsql-instances="${INSTANCE_CONNECTION_NAME}" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest" \
  --command="node_modules/.bin/prisma" \
  --args="migrate,deploy" \
  --project="${PROJECT_ID}" \
  2>/dev/null || \
gcloud run jobs update messaging-migrate \
  --image="${API_IMAGE}" \
  --region="${REGION}" \
  --service-account="${SA_EMAIL}" \
  --add-cloudsql-instances="${INSTANCE_CONNECTION_NAME}" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest" \
  --command="node_modules/.bin/prisma" \
  --args="migrate,deploy" \
  --project="${PROJECT_ID}"

echo "==> Executing migration job (waiting for completion)..."
gcloud run jobs execute messaging-migrate \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --wait

echo ""
echo "==> Deploying messaging-api Cloud Run service..."
gcloud run deploy messaging-api \
  --image="${API_IMAGE}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --service-account="${SA_EMAIL}" \
  --add-cloudsql-instances="${INSTANCE_CONNECTION_NAME}" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest" \
  --port=3001 \
  --min-instances=1 \
  --project="${PROJECT_ID}"

API_URL=$(gcloud run services describe messaging-api \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(status.url)')

echo ""
echo "Done. API URL: ${API_URL}"
echo "  Webhook endpoint: ${API_URL}/webhooks/whatsapp"
