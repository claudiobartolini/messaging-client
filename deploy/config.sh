#!/usr/bin/env bash
# Shared configuration for all deploy scripts.
# Copy this file and fill in the values before running any script.

set -euo pipefail

# ── Required — fill these in ─────────────────────────────────────────────────
export PROJECT_ID="${PROJECT_ID:-skynet-gcp-network}"
export REGION="${REGION:-europe-west1}"
export INSTANCE_CONNECTION_NAME="${INSTANCE_CONNECTION_NAME:-${PROJECT_ID}:${REGION}:messaging-db}"
export SA_EMAIL="${SA_EMAIL:-messaging-api@${PROJECT_ID}.iam.gserviceaccount.com}"

# ── Derived — usually no need to change ──────────────────────────────────────
export REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/messaging"
export API_IMAGE="${REGISTRY}/api:latest"
export WEB_IMAGE="${REGISTRY}/web:latest"
