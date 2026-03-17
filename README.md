# messaging-client

A multi-channel messaging client built with Node.js and React. Start with WhatsApp Business API, expand to Teams and other channels.

## Features

- **Multi-channel inbox** — view and reply to conversations across all configured channels in one place
- **Channel adapter pattern** — adding a new channel requires one file, zero changes to existing code
- **Real-time updates** — inbound messages appear instantly via Socket.IO
- **Settings console** — configure channels (API keys, tokens, webhooks) from the UI

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Fastify + Prisma + PostgreSQL |
| Real-time | Socket.IO + Redis |
| Frontend | React 19 + Vite + Zustand + TanStack Query |
| Monorepo | pnpm workspaces + Turborepo |

## Project structure

```
messaging-client/
├── packages/shared/       # Shared TypeScript types & Zod schemas
├── apps/api/              # Fastify backend
│   ├── src/channels/      # Channel adapters (WhatsApp, ...)
│   ├── src/conversations/ # Conversations & messages API
│   ├── src/settings/      # Channel configuration API
│   ├── src/webhooks/      # Inbound webhook handler
│   └── prisma/            # Database schema
├── apps/web/              # React frontend
└── docker-compose.yml     # PostgreSQL + Redis
```

## Getting started

### Prerequisites

- Node.js 20+
- pnpm
- Docker

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
```

Fill in `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres:secret@localhost:5432/messaging"
REDIS_URL="redis://localhost:6379"

# WhatsApp Business API (from Meta Developer dashboard)
WHATSAPP_ACCESS_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=your_chosen_verify_token
```

### 3. Start infrastructure

```bash
docker compose up -d
```

### 4. Run database migrations

```bash
pnpm --filter @messaging/api db:migrate
```

### 5. Start development servers

```bash
pnpm dev
```

- API: http://localhost:3001
- Web: http://localhost:5173

## WhatsApp Business API setup

1. Create a Meta Developer app at [developers.facebook.com](https://developers.facebook.com) (type: Business)
2. Add the WhatsApp product — note your **Phone Number ID**
3. Create a System User in Meta Business Suite and generate a **permanent access token**
4. Use [ngrok](https://ngrok.com) or [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to expose your local server:
   ```bash
   ngrok http 3001
   ```
5. Set the webhook URL in Meta dashboard: `https://<your-tunnel>/webhooks/whatsapp`
6. Set the verify token to match `WHATSAPP_VERIFY_TOKEN` in your `.env`
7. Subscribe to: `messages`, `message_deliveries`, `message_reads`

## Adding a new channel

1. Create `apps/api/src/channels/<name>/<name>.adapter.ts` implementing `ChannelAdapter`
2. Register it in `apps/api/src/main.ts`: `registry.register(new YourAdapter())`
3. Add the channel type to `packages/shared/src/types/channel.ts`

No other changes needed — the webhook router, API routes, settings UI, and frontend all pick it up automatically.

## API reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/channels` | List channels + available types |
| POST | `/api/channels` | Add a channel |
| PUT | `/api/channels/:id` | Update channel config |
| DELETE | `/api/channels/:id` | Remove a channel |
| GET | `/api/conversations` | List conversations |
| GET | `/api/conversations/:id/messages` | Get messages |
| POST | `/api/conversations/:id/messages` | Send a message |
| GET/POST | `/webhooks/:channelType` | Webhook endpoint |
