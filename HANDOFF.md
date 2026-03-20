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

### Teams — FULLY WORKING
- `TeamsAdapter` implemented at `apps/api/src/channels/teams/teams.adapter.ts`
- Registered in `apps/api/src/main.ts`
- Azure Bot resource created, Teams channel connected
- Inbound messages arrive in the inbox, replies are delivered back to Teams
- Bot deployed as a custom Teams App (package at `~/teams-app.zip`)
- Webhook endpoint: `/webhooks/teams` (requires ngrok or public URL pointed at port 3001)

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

### Azure (Teams — fully configured)
- **Microsoft App ID:** `d71e49d8-4263-4d9d-b204-c8e7e8ceacd1`
- **App Tenant ID:** `463d4265-fcf2-475e-b0d6-4d53cf2fffcd`
- **Client Secret:** stored in `apps/api/.env` as `TEAMS_CLIENT_SECRET` (also re-add via Settings UI if DB is reset)
- **Azure Bot messaging endpoint:** `https://<ngrok-url>/webhooks/teams` (update when ngrok URL changes)
- **Teams App package:** `~/teams-app.zip` — upload via Teams → Apps → Upload a custom app to reinstall the bot

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

Then go to localhost:5173/settings and re-add the WhatsApp and Teams channels with your credentials.

### To receive real messages (ngrok required for both channels)
```bash
ngrok http 3001
# Copy the https URL, then update:
# - Meta → WhatsApp → Configuration → Callback URL: https://<ngrok-url>/webhooks/whatsapp
# - Azure Bot resource → Configuration → Messaging endpoint: https://<ngrok-url>/webhooks/teams
```

### Docker setup (WSL)
```bash
sudo service docker start   # start Docker daemon
docker compose up -d        # start Postgres + Redis
newgrp docker               # if docker group was just added
```

---

## What was built

1. **Initial scaffold** — monorepo with Fastify API, React frontend, shared types package
2. **3-panel inbox UI** — Sidebar, ConversationList, MessageThread with real-time Socket.IO
3. **WhatsApp adapter** — full send/receive via Meta Graph API, webhook verification
4. **Settings UI** — add/enable/disable/delete channels dynamically
5. **Teams adapter** — full send/receive via Bot Framework, Azure Bot + Teams channel configured
6. **Bug fixes:**
   - Channel delete failing due to `Content-Type` header on bodyless DELETE
   - Channel delete blocked by FK constraints (missing cascade)
   - `res.json()` called on 204 No Content response
   - Teams replies broken: `serviceUrl` not preserved — fixed by encoding `serviceUrl::conversationId` into `contactId` at ingest time

---

## Next steps

1. **Deploy** — replace ngrok with a permanent domain; update Meta webhook URL and Azure Bot messaging endpoint
2. **Production token** — WhatsApp System User token is already long-lived (never expires), no action needed
3. **Teams webhook security** — add JWT validation for inbound Bot Framework requests (currently unauthenticated)

---

## Important notes

**Keep safe (not in GitHub):**
- Your WhatsApp **Access Token** (long-lived System User token from Meta Business Suite) — store it in a password manager
- Your WhatsApp **Verify Token** — the string you chose when setting up the webhook in Meta's dashboard

**You don't need to keep** `apps/api/.env` — it only contains local Postgres/Redis defaults, no real secrets.

**The WhatsApp channel config** (tokens, phone number ID) is stored in your local Postgres database, not in any file. If you reset the database or move to a new machine, you'll need to re-add the channel via localhost:5173/settings using those saved credentials.
