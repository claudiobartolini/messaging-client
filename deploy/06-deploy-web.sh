#!/usr/bin/env bash
# Task 6 — Deploy the web frontend to Cloud Run (Option B — separate domains).
# Depends on: 04-push-images.sh (can run in parallel with 05-deploy-api.sh once
# the API URL is known)
#
# Bootstrap order for first deploy:
#   1. bash deploy/05-deploy-api.sh          → note the API URL
#   2. VITE_API_URL=<api-url> bash deploy/04-push-images.sh
#   3. bash deploy/06-deploy-web.sh
#
# Usage:
#   PROJECT_ID=skynet-messaging bash deploy/06-deploy-web.sh

set -euo pipefail
source "$(dirname "$0")/config.sh"

echo "==> Deploying messaging-web Cloud Run service..."
gcloud run deploy messaging-web \
  --image="${WEB_IMAGE}" \
  --region="${REGION}" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --project="${PROJECT_ID}"

WEB_URL=$(gcloud run services describe messaging-web \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(status.url)')

echo ""
echo "Done. Web URL: ${WEB_URL}"
echo ""
echo "Next — register WhatsApp webhook (Task 7):"
echo "  Meta for Developers → WhatsApp → Configuration"
echo "  Webhook URL   : see API URL from 05-deploy-api.sh output"
echo "  Verify token  : value stored in the channel config"
