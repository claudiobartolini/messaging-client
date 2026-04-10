#!/usr/bin/env bash
# Task 4 — Create Artifact Registry repo, build, and push Docker images.
# Depends on: 01-gcp-setup.sh
# Run from the repo root.
#
# Usage:
#   PROJECT_ID=skynet-messaging bash deploy/04-push-images.sh
#
# Optional:
#   VITE_API_URL=https://messaging-api-xxxx-ew.a.run.app \
#     PROJECT_ID=skynet-messaging bash deploy/04-push-images.sh
#   (Only needed if deploying web with separate API domain — Option B)

set -euo pipefail
source "$(dirname "$0")/config.sh"

VITE_API_URL="${VITE_API_URL:?Set VITE_API_URL to the API Cloud Run URL before building (e.g. https://messaging-api-xxxx-ew.a.run.app). Run 05-deploy-api.sh first to get it.}"

echo "==> Creating Artifact Registry repository 'messaging'..."
gcloud artifacts repositories create messaging \
  --repository-format=docker \
  --location="${REGION}" \
  --project="${PROJECT_ID}" || echo "Repository already exists — skipping."

echo "==> Configuring Docker authentication..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo "==> Building API image..."
docker build \
  -f apps/api/Dockerfile \
  -t "${API_IMAGE}" \
  .

echo "==> Pushing API image..."
docker push "${API_IMAGE}"

echo "==> Building web image (VITE_API_URL=${VITE_API_URL})..."
docker build \
  -f apps/web/Dockerfile \
  --build-arg "VITE_API_URL=${VITE_API_URL}" \
  -t "${WEB_IMAGE}" \
  .

echo "==> Pushing web image..."
docker push "${WEB_IMAGE}"

echo ""
echo "Done. Images pushed to Artifact Registry:"
echo "  API : ${API_IMAGE}"
echo "  Web : ${WEB_IMAGE}"
