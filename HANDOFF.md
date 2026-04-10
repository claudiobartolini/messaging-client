# Project Handoff: messaging-client

## What this is
A multi-channel messaging inbox built as a pnpm + Turborepo monorepo. Lets you receive and reply to messages from multiple channels (WhatsApp, Teams) in a unified 3-panel UI.

**GitHub:** https://github.com/claudiobartolini/messaging-client
**Stack:** Fastify API + Prisma + PostgreSQL + Redis + Socket.IO (backend), React 19 + Vite + Zustand + TanStack Query (frontend)

---

## Deployment status (as of 2026-04-10)

### GCP project: `skynet-gcp-network` (project number `507526882837`)

| Service | URL | Status |
|---|---|---|
| **API** | `https://messaging-api-507526882837.europe-west1.run.app` | ✅ Live, healthy |
| **Web** | `https://messaging-web-507526882837.europe-west1.run.app` | ✅ Live |

### Infrastructure
| Resource | Details |
|---|---|
| Cloud SQL | `messaging-db` — Postgres 16, `db-g1-small`, `europe-west1` |
| Instance connection name | `skynet-gcp-network:europe-west1:messaging-db` |
| Memorystore Redis | `messaging-redis` — Redis 7, 1GB Basic, `10.114.207.147:6379` |
| VPC connector | `messaging-connector` (`europe-west1`) |
| Artifact Registry | `europe-west1-docker.pkg.dev/skynet-gcp-network/messaging/` |
| Service account | `messaging-api@skynet-gcp-network.iam.gserviceaccount.com` |
| WIF pool/provider | `github-pool` / `github-provider` |

### Secrets in Secret Manager
| Secret | Contains |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string via Cloud SQL Unix socket |
| `REDIS_URL` | `redis://10.114.207.147:6379` |

### GitHub Actions variables (set)
| Variable | Value |
|---|---|
| `GCP_PROJECT_ID` | `skynet-gcp-network` |
| `GCP_REGION` | `europe-west1` |
| `VITE_API_URL` | `https://messaging-api-507526882837.europe-west1.run.app` |

### GitHub Actions secrets (set)
| Secret | Value |
|---|---|
| `WIF_PROVIDER` | `projects/507526882837/locations/global/workloadIdentityPools/github-pool/providers/github-provider` |
| `WIF_SERVICE_ACCOUNT` | `messaging-api@skynet-gcp-network.iam.gserviceaccount.com` |

---

## What still needs to happen before end-to-end test

### Task 7 — Register WhatsApp webhook + test
1. Go to **Meta for Developers → your app → WhatsApp → Configuration**
   - Callback URL: `https://messaging-api-507526882837.europe-west1.run.app/webhooks/whatsapp`
   - Verify token: the string you used when first setting up the webhook
2. Open `https://messaging-web-507526882837.europe-west1.run.app` → Settings → Add WhatsApp channel:
   - Phone Number ID: `1044544528747410`
   - WhatsApp Business Account ID: `933045345786972`
   - Access Token: long-lived System User token from Meta Business Suite
   - Verify Token: same string as above
3. Send a WhatsApp message to the test number → should appear in the inbox in real time
4. Reply from dashboard → verify delivery + read receipts (✓ → ✓✓ grey → ✓✓ blue)

### Keycloak (pending — was pending Friday in previous session too)
All code is written. Just needs real values in the environment:
- `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID` → add as secrets in Secret Manager + mount in Cloud Run
- `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` → add as build-time env vars, rebuild web image

### Teams channel
- Blocked on Azure AD App Registration (needs work/school account)
- Microsoft App ID: `91326745-ce2f-411c-bcbb-bc32596dd026`
- App Tenant ID: `99f5c844-7eaf-4d36-881f-20829ad20273`

---

## CI/CD (GitHub Actions)

Push to `main` → builds both Docker images for `linux/amd64` → runs `prisma migrate deploy` via Cloud Run Job → deploys API and web in parallel.

**Important:** Images must be built for `linux/amd64`. Locally use:
```bash
docker buildx build --platform=linux/amd64 ...
```

---

## Known issues / gotchas

1. **`--allow-unauthenticated` warning** — org policy blocks setting this via `gcloud run deploy`. Needs Owner to run:
   ```bash
   gcloud beta run services add-iam-policy-binding --region=europe-west1 \
     --member=allUsers --role=roles/run.invoker messaging-api --project=skynet-gcp-network
   gcloud beta run services add-iam-policy-binding --region=europe-west1 \
     --member=allUsers --role=roles/run.invoker messaging-web --project=skynet-gcp-network
   ```

2. **Prisma on Alpine** — `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` is set in `schema.prisma`. Do not remove it.

3. **Prisma client in standalone** — `apps/api/Dockerfile` runs `prisma generate` inside `api-standalone` after `pnpm deploy --prod`. This is required — do not remove that step.

4. **DB password** — stored only in Secret Manager as part of `DATABASE_URL`. Not written anywhere else. If you need it, read the secret: `gcloud secrets versions access latest --secret=DATABASE_URL --project=skynet-gcp-network`

5. **Socket.IO with separate domains** — `VITE_API_URL` is baked into the web image at build time. If the API URL ever changes, rebuild the web image with the new URL.

---

## Local development (unchanged)

```bash
# Prerequisites: Node 20+, pnpm, Docker
git clone https://github.com/claudiobartolini/messaging-client
cd messaging-client
pnpm install
cp apps/api/.env.example apps/api/.env
docker compose up -d
pnpm --filter @messaging/api db:migrate
pnpm dev
# API: localhost:3001 — Web: localhost:5173
```

---

## WhatsApp credentials (keep safe)
- **Phone Number ID:** `1044544528747410`
- **WhatsApp Business Account ID:** `933045345786972`
- **Access Token:** long-lived System User token from Meta Business Suite (never expires) — store in password manager
- **Verify Token:** the string you chose in Meta's dashboard

## Azure credentials (Teams — incomplete)
- **Microsoft App ID:** `91326745-ce2f-411c-bcbb-bc32596dd026`
- **App Tenant ID:** `99f5c844-7eaf-4d36-881f-20829ad20273`
- **Client Secret:** NOT YET CREATED
