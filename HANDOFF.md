# Project Handoff: messaging-client

## What this is
A multi-channel messaging inbox built as a pnpm + Turborepo monorepo. Lets you receive and reply to messages from multiple channels (WhatsApp, Teams) in a unified 3-panel UI.

**GitHub:** https://github.com/claudiobartolini/messaging-client
**Stack:** Fastify API + Prisma + PostgreSQL + Redis + Socket.IO (backend), React 19 + Vite + Zustand + TanStack Query (frontend)

---

## Current status

### WhatsApp — FULLY WORKING
- Messages sent to the test WhatsApp number arrive in the inbox at localhost:5173 in real time
- Replies from the inbox are sent back via WhatsApp
- Webhook verified and subscribed to `messages` field in Meta dashboard

### Teams — CODE WRITTEN, NOT YET CONNECTED
- `TeamsAdapter` implemented at `apps/api/src/channels/teams/teams.adapter.ts`
- Registered in `apps/api/src/main.ts`
- Blocked on: Azure AD App Registration requires a work/school Microsoft account (free personal Azure account doesn't have AD access)
- To resume: sign into Azure with a work account, create an App Registration, generate a client secret, then add the Teams channel via Settings UI

---

## Credentials & secrets to preserve

### WhatsApp (stored in the Postgres database via Settings UI — NOT in .env)
You'll need to re-add the channel via localhost:5173/settings if you reset the database. Have these ready:
- **Phone Number ID:** `1044544528747410`
- **WhatsApp Business Account ID:** `933045345786972`
- **Access Token:** your long-lived System User token from Meta Business Suite (never expires)
- **Verify Token:** the string you chose (whatever you entered in Meta's dashboard)

### Meta Developer App
- **App:** created at developers.facebook.com
- **Webhook Callback URL:** needs to be updated whenever your ngrok URL changes (ngrok free tier gets a new URL each restart)
- **Webhook field subscribed:** `messages`

### Azure (Teams — incomplete)
- **Microsoft App ID:** `91326745-ce2f-411c-bcbb-bc32596dd026`
- **App Tenant ID:** `99f5c844-7eaf-4d36-881f-20829ad20273`
- **Resource group:** `messaging-client-rg`
- **Bot handle:** `messaging-client-bot`
- **Client Secret:** NOT YET CREATED (blocked on AD permissions)

### Local .env (apps/api/.env — not committed, recreate from .env.example)
```
DATABASE_URL="postgresql://postgres:secret@localhost:5432/messaging"
REDIS_URL="redis://localhost:6379"
PORT=3001
```
The WhatsApp env vars in .env.example are unused — credentials go in the DB via the Settings UI.

---

## How to run locally

```bash
# Prerequisites: Node 20+, pnpm, Docker

git clone https://github.com/claudiobartolini/messaging-client
cd messaging-client
pnpm install

# Create .env
cp apps/api/.env.example apps/api/.env

# Start Postgres + Redis
docker compose up -d

# Run migrations
pnpm --filter @messaging/api db:migrate

# Start everything
pnpm dev
# API: localhost:3001
# Web: localhost:5173
```

Then go to localhost:5173/settings and re-add the WhatsApp channel with your credentials.

### To receive real WhatsApp messages (ngrok required)
```bash
ngrok http 3001 --request-header-add "ngrok-skip-browser-warning: true"
# Copy the https URL
# Update Callback URL in Meta → WhatsApp → Configuration to:
# https://<your-ngrok-url>/webhooks/whatsapp
```

---

## What was built in this session

1. **Initial scaffold** — monorepo with Fastify API, React frontend, shared types package
2. **3-panel inbox UI** — Sidebar, ConversationList, MessageThread with real-time Socket.IO
3. **WhatsApp adapter** — full send/receive via Meta Graph API, webhook verification
4. **Settings UI** — add/enable/disable/delete channels dynamically
5. **Bug fixes:**
   - Channel delete was failing due to `Content-Type: application/json` sent on DELETE with no body
   - Channel delete was failing due to missing cascade (conversations/messages/webhookEvents blocked FK delete)
   - `res.json()` called on 204 No Content response
6. **Teams adapter** — written, registered, not yet connected to Azure

---

## Next steps

1. **Wire up Keycloak on Friday** — see the Keycloak section below; all integration code is already written
2. **Finish Teams setup** — needs work/school Azure account to create App Registration + client secret
3. **Deploy** — replace ngrok with a real server; update Meta webhook URL
4. **Production token** — WhatsApp System User token is already long-lived (never expires), no action needed

---

---

## Keycloak Authentication

All integration code is written and wired up. The only thing missing is the real Keycloak host/realm values, which will be available Friday when the realm is configured onsite.

### How it works

**Frontend flow (`apps/web`)**
- `src/keycloak.ts` — creates the `keycloak-js` instance from three `VITE_*` env vars
- `src/main.tsx` — calls `keycloak.init({ onLoad: 'login-required', pkceMethod: 'S256' })` before mounting React. If the user is not authenticated, `keycloak-js` redirects them to the Keycloak login page automatically. The React app only mounts after a successful login.
- `src/api/client.ts` — every API request includes `Authorization: Bearer <token>` taken from `keycloak.token`. The token is kept in memory (never localStorage) by `keycloak-js`.

**Backend flow (`apps/api`)**
- `@fastify/jwt` is registered with a dynamic JWKS secret resolver using `jwks-rsa`. On each request, it fetches the signing public key from Keycloak's JWKS endpoint (`/realms/<realm>/protocol/openid-connect/certs`) and verifies the JWT signature using RS256.
- An `onRequest` hook guards every route under `/api/*`. Any request without a valid Bearer token receives a `401 Unauthorized`.
- Routes under `/webhooks/*` and the `/health` endpoint are **not** protected — inbound webhooks from WhatsApp/Teams arrive unauthenticated by design.

### Wiring it up Friday

**1. Create a `.env` entry in `apps/api/.env`:**
```
KEYCLOAK_URL=https://<your-keycloak-host>
KEYCLOAK_REALM=<your-realm-name>
KEYCLOAK_CLIENT_ID=messaging-client
```

**2. Create a Vite env file for the web app** (e.g. `apps/web/.env.local` — not committed):
```
VITE_KEYCLOAK_URL=https://<your-keycloak-host>
VITE_KEYCLOAK_REALM=<your-realm-name>
VITE_KEYCLOAK_CLIENT_ID=messaging-client
```

**3. Configure the Keycloak client** in the admin console:
- Client type: `OpenID Connect`
- Client authentication: **OFF** (public client — SPA)
- Standard flow: **ON**
- Valid redirect URIs: `http://localhost:5173/*` (add your production URL too)
- Valid post logout redirect URIs: `http://localhost:5173/*`
- Web origins: `http://localhost:5173` (or `+` to allow all redirect URIs)

**4. Restart both apps** — `pnpm dev`. Opening the web app should now redirect to Keycloak login.

### Verification checklist
- [ ] Open `http://localhost:5173` → redirected to Keycloak login page
- [ ] Login with a valid realm user → lands on the inbox
- [ ] Inspect Network tab → all `/api/*` requests carry `Authorization: Bearer ...`
- [ ] `curl http://localhost:3001/api/conversations` → `401 Unauthorized`
- [ ] `curl -X POST http://localhost:3001/webhooks/whatsapp` → not a 401 (passes auth, may 400 on bad payload)
- [ ] `curl http://localhost:3001/health` → `{"status":"ok"}`

### Files changed
| File | What changed |
|------|-------------|
| `apps/web/src/keycloak.ts` | New — Keycloak instance, reads `VITE_*` env vars |
| `apps/web/src/main.tsx` | Init Keycloak with `login-required` before mounting React |
| `apps/web/src/api/client.ts` | Inject `Authorization: Bearer` header on every request |
| `apps/web/package.json` | Added `keycloak-js@^26` |
| `apps/api/src/main.ts` | Register `@fastify/jwt` + JWKS resolver; `onRequest` hook for `/api/*` |
| `apps/api/package.json` | Added `@fastify/jwt@^9`, `jwks-rsa@^3` |
| `apps/api/.env.example` | Added `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID` placeholders |

---

## Important notes

**Keep safe (not in GitHub):**
- Your WhatsApp **Access Token** (long-lived System User token from Meta Business Suite) — store it in a password manager
- Your WhatsApp **Verify Token** — the string you chose when setting up the webhook in Meta's dashboard

**You don't need to keep** `apps/api/.env` — it only contains local Postgres/Redis defaults, no real secrets.

**The WhatsApp channel config** (tokens, phone number ID) is stored in your local Postgres database, not in any file. If you reset the database or move to a new machine, you'll need to re-add the channel via localhost:5173/settings using those saved credentials.
