# Project Handoff: messaging-client

## What this is
A multi-channel messaging inbox built as a pnpm + Turborepo monorepo. Lets you receive and reply to messages from multiple channels (WhatsApp via Vonage, Microsoft Teams) in a unified 3-panel UI.

**GitHub (personal):** https://github.com/claudiobartolini/messaging-client
**GitHub (org):** https://github.com/Skynet-Technology-Develop/messaging-client
**Stack:** Fastify API + Prisma + PostgreSQL + Redis + Socket.IO (backend), React 19 + Vite + Zustand + TanStack Query (frontend)

---

## Deployment status (as of 2026-05-29)

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

### Service account IAM roles (all granted)
- `roles/artifactregistry.writer` — push images to Artifact Registry
- `roles/run.developer` — deploy Cloud Run services and jobs
- `roles/iam.serviceAccountUser` — act as service accounts during deploy

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

## Active channels (configured in DB)

### WhatsApp via Vonage
Skynet uses Vonage as their WhatsApp BSP. A new `vonage` channel adapter was added alongside the original `whatsapp` adapter.

| Field | Value |
|---|---|
| Channel type | `vonage` |
| From number | `+390553980466` |
| Vonage Application | configured — inbound + status URL both point to `/webhooks/vonage` |
| API Key / Secret | stored in channel config in DB (not in codebase) |
| Status | ✅ Inbound and outbound tested and working |

### Microsoft Teams
| Field | Value |
|---|---|
| Channel type | `teams` |
| Azure Bot name | `messaging-bot` |
| Azure Bot App ID | `d71e49d8-4263-4d9d-b204-c8e7e8ceacd1` |
| Azure AD Tenant ID | `463d4265-fcf2-475e-b0d6-4d53cf2fffcd` |
| Messaging endpoint | `https://messaging-api-507526882837.europe-west1.run.app/webhooks/teams` |
| App ID + Secret | stored in channel config in DB (not in codebase) |
| Status | ✅ Inbound and outbound tested and working |

> **Note:** There is an unused App Registration `b51e84a6-9fff-490a-b9ce-5b227078d7e3` created during setup — it can be deleted from Azure AD.

---

## CI/CD (GitHub Actions)

Push to `main` on either remote → builds both Docker images for `linux/amd64` → runs `prisma migrate deploy` via Cloud Run Job → deploys API and web in parallel. **All jobs are now fully green.**

CI/CD is configured on the personal repo (`claudiobartolini/messaging-client`). The Skynet org repo (`Skynet-Technology-Develop/messaging-client`) is a mirror — push to both remotes to keep them in sync.

**Important:** Images must be built for `linux/amd64`. Locally use:
```bash
docker buildx build --platform=linux/amd64 ...
```

---

## Pending work

### Sarah co-pilot integration — turn forwarding
Full implementation plan is in `PLAN.md` at the repo root. Summary:
- New `apps/api/src/services/sarah.ts` — BullMQ queue + worker that POSTs every conversation turn (inbound and outbound, all channels) to `SARAH_WEBHOOK_URL`
- Hook into `apps/api/src/webhooks/routes.ts` (inbound) and `apps/api/src/conversations/routes.ts` (outbound)
- At-least-once delivery: jobs persist in Redis, retry up to 5×with exponential backoff; `messageId` in payload lets Sarah deduplicate
- No DB changes, no auth changes, no UI changes — just add `SARAH_WEBHOOK_URL` env var

### Teams — attachment/image support
When a Teams user sends an image or file, it currently does not appear in the inbox. The adapter only processes text messages. Two levels of fix available:
- **Basic:** Show `📎 filename.ext` in the message body — ~30 min
- **Full:** Backend proxy endpoint that fetches the file with a Bot Framework token and streams it to the browser, frontend renders images inline — ~2-3 hours

### Keycloak authentication
All code is written. Just needs real values added to the environment:
- `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID` → add as secrets in Secret Manager + mount in Cloud Run
- `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` → add as build-time GitHub Actions variables, then push to trigger a web rebuild

### Option A — single domain load balancer
The domain `xcall.it` is reserved. The LB script is ready at `deploy/07-load-balancer.sh`:
```bash
DOMAIN=xcall.it PROJECT_ID=skynet-gcp-network bash deploy/07-load-balancer.sh
```
After running: create DNS A record, wait ~15 min for SSL cert, clear `VITE_API_URL` in GitHub Actions variables and push to redeploy the web image.

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

4. **DB password** — stored only in Secret Manager as part of `DATABASE_URL`. If you need it: `gcloud secrets versions access latest --secret=DATABASE_URL --project=skynet-gcp-network`

5. **Socket.IO with separate domains** — `VITE_API_URL` is baked into the web image at build time. If the API URL ever changes, rebuild the web image with the new URL. Resolved once Option A (single domain LB) is live.

6. **Teams serviceUrl** — outbound Teams messages require `serviceUrl::conversationId` as the `to` address. This is stored correctly for all new conversations. Any conversations created before 2026-05-29 in the DB have the old format and cannot receive replies — they can be ignored.

7. **Git credentials** — the macOS Keychain credential for GitHub was cleared during setup. Future `git push origin` will prompt for re-authentication via browser. Use `git push <url-with-pat> main` as a workaround if needed.

---

## Local development

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
