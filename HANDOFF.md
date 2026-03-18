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

1. **Finish Teams setup** — needs work/school Azure account to create App Registration + client secret
2. **Deploy** — replace ngrok with a real server; update Meta webhook URL
3. **Production token** — WhatsApp System User token is already long-lived (never expires), no action needed

---

## Important notes

**Keep safe (not in GitHub):**
- Your WhatsApp **Access Token** (long-lived System User token from Meta Business Suite) — store it in a password manager
- Your WhatsApp **Verify Token** — the string you chose when setting up the webhook in Meta's dashboard

**You don't need to keep** `apps/api/.env` — it only contains local Postgres/Redis defaults, no real secrets.

**The WhatsApp channel config** (tokens, phone number ID) is stored in your local Postgres database, not in any file. If you reset the database or move to a new machine, you'll need to re-add the channel via localhost:5173/settings using those saved credentials.
