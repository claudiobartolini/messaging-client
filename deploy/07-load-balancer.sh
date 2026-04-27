#!/usr/bin/env bash
# Task 7 — Create the HTTPS Application Load Balancer (Option A: single domain).
#
# Routes:
#   /api, /api/*        → messaging-api  Cloud Run service
#   /webhooks/*         → messaging-api  Cloud Run service
#   /socket.io, /socket.io/* → messaging-api Cloud Run service
#   /* (everything else) → messaging-web Cloud Run service
#
# Depends on: 05-deploy-api.sh, 06-deploy-web.sh
#
# Usage:
#   DOMAIN=dashboard.example.com PROJECT_ID=skynet-gcp-network \
#     bash deploy/07-load-balancer.sh
#
# After running:
#   1. Create an A record: DOMAIN → the printed IP address
#   2. Wait ~15 min for the managed SSL cert to provision
#   3. Set the VITE_API_URL repo variable to "" (empty) — not needed for Option A

set -euo pipefail
source "$(dirname "$0")/config.sh"

DOMAIN="${DOMAIN:?Set DOMAIN to your custom domain, e.g. dashboard.skynet.io}"

echo "==> Project : ${PROJECT_ID}"
echo "==> Region  : ${REGION}"
echo "==> Domain  : ${DOMAIN}"
echo ""

# ── Serverless Network Endpoint Groups ───────────────────────────────────────
echo "==> Creating serverless NEG for messaging-api..."
gcloud compute network-endpoint-groups create messaging-api-neg \
  --region="${REGION}" \
  --network-endpoint-type=serverless \
  --cloud-run-service=messaging-api \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  messaging-api-neg already exists — skipping."

echo "==> Creating serverless NEG for messaging-web..."
gcloud compute network-endpoint-groups create messaging-web-neg \
  --region="${REGION}" \
  --network-endpoint-type=serverless \
  --cloud-run-service=messaging-web \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  messaging-web-neg already exists — skipping."

# ── Backend services ──────────────────────────────────────────────────────────
echo "==> Creating backend service for API..."
gcloud compute backend-services create messaging-api-backend \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --global \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  messaging-api-backend already exists — skipping."

gcloud compute backend-services add-backend messaging-api-backend \
  --global \
  --network-endpoint-group=messaging-api-neg \
  --network-endpoint-group-region="${REGION}" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  API backend already attached — skipping."

echo "==> Creating backend service for web..."
gcloud compute backend-services create messaging-web-backend \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --global \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  messaging-web-backend already exists — skipping."

gcloud compute backend-services add-backend messaging-web-backend \
  --global \
  --network-endpoint-group=messaging-web-neg \
  --network-endpoint-group-region="${REGION}" \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  Web backend already attached — skipping."

# ── URL map with path-based routing ──────────────────────────────────────────
echo "==> Configuring URL map with path rules..."
URL_MAP_FILE=$(mktemp)
cat > "${URL_MAP_FILE}" <<EOF
defaultService: https://www.googleapis.com/compute/v1/projects/${PROJECT_ID}/global/backendServices/messaging-web-backend
hostRules:
- hosts:
  - "*"
  pathMatcher: main
pathMatchers:
- name: main
  defaultService: https://www.googleapis.com/compute/v1/projects/${PROJECT_ID}/global/backendServices/messaging-web-backend
  pathRules:
  - paths:
    - /api
    - /api/*
    - /webhooks
    - /webhooks/*
    - /socket.io
    - /socket.io/*
    service: https://www.googleapis.com/compute/v1/projects/${PROJECT_ID}/global/backendServices/messaging-api-backend
EOF

gcloud compute url-maps import messaging-lb \
  --source="${URL_MAP_FILE}" \
  --global \
  --project="${PROJECT_ID}" \
  --quiet
rm "${URL_MAP_FILE}"

# ── Managed SSL certificate ───────────────────────────────────────────────────
echo "==> Creating managed SSL certificate for ${DOMAIN}..."
gcloud compute ssl-certificates create messaging-cert \
  --domains="${DOMAIN}" \
  --global \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  messaging-cert already exists — skipping."

# ── Target HTTPS proxy ────────────────────────────────────────────────────────
echo "==> Creating target HTTPS proxy..."
gcloud compute target-https-proxies create messaging-https-proxy \
  --ssl-certificates=messaging-cert \
  --url-map=messaging-lb \
  --global \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  messaging-https-proxy already exists — skipping."

# ── Global forwarding rule — port 443 ─────────────────────────────────────────
echo "==> Creating HTTPS forwarding rule..."
gcloud compute forwarding-rules create messaging-https \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --network-tier=PREMIUM \
  --global \
  --target-https-proxy=messaging-https-proxy \
  --ports=443 \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  messaging-https forwarding rule already exists — skipping."

# ── HTTP → HTTPS redirect ─────────────────────────────────────────────────────
echo "==> Configuring HTTP → HTTPS redirect..."
REDIRECT_MAP_FILE=$(mktemp)
cat > "${REDIRECT_MAP_FILE}" <<'EOF'
defaultUrlRedirect:
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
  httpsRedirect: true
EOF

gcloud compute url-maps import messaging-http-redirect \
  --source="${REDIRECT_MAP_FILE}" \
  --global \
  --project="${PROJECT_ID}" \
  --quiet
rm "${REDIRECT_MAP_FILE}"

gcloud compute target-http-proxies create messaging-http-proxy \
  --url-map=messaging-http-redirect \
  --global \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  messaging-http-proxy already exists — skipping."

gcloud compute forwarding-rules create messaging-http \
  --load-balancing-scheme=EXTERNAL_MANAGED \
  --network-tier=PREMIUM \
  --global \
  --target-http-proxy=messaging-http-proxy \
  --ports=80 \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  messaging-http forwarding rule already exists — skipping."

# ── Print the LB IP ───────────────────────────────────────────────────────────
LB_IP=$(gcloud compute forwarding-rules describe messaging-https \
  --global \
  --project="${PROJECT_ID}" \
  --format='value(IPAddress)')

echo ""
echo "================================================================"
echo "  Load balancer ready"
echo "  IP: ${LB_IP}"
echo ""
echo "  Next steps:"
echo "  1. Create an A record in your DNS:"
echo "       ${DOMAIN}  →  ${LB_IP}"
echo ""
echo "  2. Wait ~15 min for DNS to propagate and the managed SSL"
echo "     cert to provision. Check cert status:"
echo "       gcloud compute ssl-certificates describe messaging-cert \\"
echo "         --global --project=${PROJECT_ID} \\"
echo "         --format='value(managed.status)'"
echo ""
echo "  3. Register the WhatsApp webhook (Task 8):"
echo "       https://${DOMAIN}/webhooks/whatsapp"
echo "================================================================"
