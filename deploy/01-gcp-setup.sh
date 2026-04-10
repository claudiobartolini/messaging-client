#!/usr/bin/env bash
# Task 1 — Create & configure the GCP project.
# Run this first. Nothing else can proceed without it.
#
# Usage:
#   PROJECT_ID=skynet-messaging bash deploy/01-gcp-setup.sh

set -euo pipefail
source "$(dirname "$0")/config.sh"

echo "==> Enabling required GCP APIs on project ${PROJECT_ID}..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com \
  cloudresourcemanager.googleapis.com \
  --project="${PROJECT_ID}"

echo "==> Creating service account: messaging-api..."
gcloud iam service-accounts create messaging-api \
  --display-name="Messaging API" \
  --project="${PROJECT_ID}" || echo "Service account already exists — skipping."

echo "==> Granting Cloud SQL client role..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client"

echo "==> Granting Secret Manager accessor role..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

echo ""
echo "Done. Deliverable:"
echo "  Project ID  : ${PROJECT_ID}"
echo "  Service acct: ${SA_EMAIL}"
