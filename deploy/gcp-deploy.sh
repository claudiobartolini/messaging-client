#!/usr/bin/env bash
# GCP deployment helper for messaging-client
# Usage: ./deploy/gcp-deploy.sh
#
# Prerequisites:
#   - gcloud CLI authenticated (`gcloud auth login`)
#   - Docker running
#   - Tasks 1–3 complete (project, Cloud SQL, Redis already provisioned)
#
# Fill in the variables below before running.

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────
PROJECT_ID="skynet-gcp-network"                   # GCP project ID
REGION="europe-west1"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/messaging"
SA_EMAIL="messaging-api@${PROJECT_ID}.iam.gserviceaccount.com"
INSTANCE_CONNECTION_NAME="${PROJECT_ID}:${REGION}:messaging-db"

# Set VITE_API_URL for Option B (separate domains).
# Leave empty ("") to build for Option A (same domain via load balancer).
VITE_API_URL=""

# ── Task 4: Build & push images ────────────────────────────────────────────────
echo "==> Authenticating Docker with Artifact Registry..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo "==> Creating Artifact Registry repository (if not exists)..."
gcloud artifacts repositories create messaging \
  --repository-format=docker \
  --location="${REGION}" \
  --project="${PROJECT_ID}" 2>/dev/null || true

echo "==> Building API image..."
docker build -f apps/api/Dockerfile \
  -t "${REGISTRY}/api:latest" .

echo "==> Pushing API image..."
docker push "${REGISTRY}/api:latest"

echo "==> Building web image (VITE_API_URL='${VITE_API_URL}')..."
docker build -f apps/web/Dockerfile \
  --build-arg VITE_API_URL="${VITE_API_URL}" \
  -t "${REGISTRY}/web:latest" .

echo "==> Pushing web image..."
docker push "${REGISTRY}/web:latest"

# ── Task 5a: Run DB migrations ──────────────────────────────────────────────────
echo "==> Creating migration job..."
gcloud run jobs create messaging-migrate \
  --image="${REGISTRY}/api:latest" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --service-account="${SA_EMAIL}" \
  --add-cloudsql-instances="${INSTANCE_CONNECTION_NAME}" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest" \
  --command="node_modules/.bin/prisma" \
  --args="migrate,deploy" 2>/dev/null || \
gcloud run jobs update messaging-migrate \
  --image="${REGISTRY}/api:latest" \
  --region="${REGION}" \
  --project="${PROJECT_ID}"

echo "==> Executing migrations (waiting for completion)..."
gcloud run jobs execute messaging-migrate \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --wait

# ── Task 5b: Deploy API service ─────────────────────────────────────────────────
echo "==> Deploying API service..."
gcloud run deploy messaging-api \
  --image="${REGISTRY}/api:latest" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --allow-unauthenticated \
  --service-account="${SA_EMAIL}" \
  --add-cloudsql-instances="${INSTANCE_CONNECTION_NAME}" \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest" \
  --port=3001 \
  --min-instances=1

API_URL=$(gcloud run services describe messaging-api \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)")
echo "==> API deployed at: ${API_URL}"

# ── Task 6: Deploy web service ──────────────────────────────────────────────────
# If VITE_API_URL was empty above and you chose Option B after the fact,
# re-run just the web build with the API URL:
#   VITE_API_URL="${API_URL}" ./deploy/gcp-deploy.sh  (only the web sections)
echo "==> Deploying web service..."
gcloud run deploy messaging-web \
  --image="${REGISTRY}/web:latest" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080

WEB_URL=$(gcloud run services describe messaging-web \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(status.url)")
echo "==> Web deployed at: ${WEB_URL}"

echo ""
echo "================================================================"
echo "  Deployment complete"
echo "  API:  ${API_URL}"
echo "  Web:  ${WEB_URL}"
echo ""
echo "  Next — Task 7: Register WhatsApp webhook"
echo "  Webhook URL: ${API_URL}/webhooks/whatsapp"
echo "================================================================"
