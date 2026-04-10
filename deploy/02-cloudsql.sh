#!/usr/bin/env bash
# Task 2 — Provision Cloud SQL (Postgres 16) and store DATABASE_URL in Secret Manager.
# Depends on: 01-gcp-setup.sh
#
# Usage:
#   PROJECT_ID=skynet-messaging DB_PASSWORD=changeme bash deploy/02-cloudsql.sh

set -euo pipefail
source "$(dirname "$0")/config.sh"

DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD before running this script}"
DB_INSTANCE="messaging-db"
DB_NAME="messaging"
DB_USER="messaging"

echo "==> Creating Cloud SQL instance ${DB_INSTANCE} (Postgres 16, db-f1-micro)..."
gcloud sql instances create "${DB_INSTANCE}" \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region="${REGION}" \
  --storage-auto-increase \
  --project="${PROJECT_ID}" || echo "Instance already exists — skipping."

echo "==> Creating database ${DB_NAME}..."
gcloud sql databases create "${DB_NAME}" \
  --instance="${DB_INSTANCE}" \
  --project="${PROJECT_ID}" || echo "Database already exists — skipping."

echo "==> Creating database user ${DB_USER}..."
gcloud sql users create "${DB_USER}" \
  --instance="${DB_INSTANCE}" \
  --password="${DB_PASSWORD}" \
  --project="${PROJECT_ID}" || echo "User already exists — skipping."

echo "==> Fetching instance connection name..."
INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe "${DB_INSTANCE}" \
  --project="${PROJECT_ID}" \
  --format='value(connectionName)')
echo "  Instance connection name: ${INSTANCE_CONNECTION_NAME}"

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${INSTANCE_CONNECTION_NAME}"

echo "==> Storing DATABASE_URL in Secret Manager..."
if gcloud secrets describe DATABASE_URL --project="${PROJECT_ID}" &>/dev/null; then
  echo -n "${DATABASE_URL}" | gcloud secrets versions add DATABASE_URL \
    --data-file=- \
    --project="${PROJECT_ID}"
  echo "  Added new version to existing secret."
else
  echo -n "${DATABASE_URL}" | gcloud secrets create DATABASE_URL \
    --data-file=- \
    --project="${PROJECT_ID}"
  echo "  Created new secret."
fi

echo ""
echo "Done. Deliverable:"
echo "  Instance connection name: ${INSTANCE_CONNECTION_NAME}"
echo "  Secret DATABASE_URL created in Secret Manager."
