# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Start all services (requires Docker running)
docker compose up -d          # Start PostgreSQL + Redis
pnpm install                  # Install all workspace dependencies
pnpm dev                      # Start all apps via Turborepo

# Individual apps
pnpm --filter @messaging/api dev    # API on :3001
pnpm --filter @messaging/web dev    # Web on :5173
```

### Database
```bash
pnpm --filter @messaging/api db:migrate   # Run migrations
pnpm --filter @messaging/api db:generate  # Regenerate Prisma client
pnpm --filter @messaging/api db:studio    # Open Prisma Studio
```

### Build & Lint
```bash
pnpm build    # Build all packages (respects dependency order via Turborepo)
pnpm lint     # Lint all packages
pnpm --filter @messaging/shared build  # Must build shared before dependent apps
```

## Architecture

This is a **pnpm + Turborepo monorepo** with three packages:

- `packages/shared` — Zod schemas and TypeScript types shared across API and web. Must be built before dependent apps.
- `apps/api` — Fastify backend with Prisma ORM, Socket.IO, and BullMQ.
- `apps/web` — React 19 + Vite frontend. Dev proxy routes `/api`, `/webhooks`, and `/socket.io` to `:3001`.

### Channel Adapter Pattern

The core extensibility mechanism. To add a new channel:

1. Implement `ChannelAdapter` interface (`apps/api/src/channels/base/channel.adapter.ts`) — requires `handleWebhook`, `sendMessage`, `verifyWebhook`, and `getConfigFields`.
2. Register the adapter in `apps/api/src/main.ts` via `channelRegistry.register(new YourAdapter())`.

The `ChannelRegistry` singleton (`apps/api/src/channels/registry.ts`) maps channel types to adapter instances at runtime.

### Real-time Flow

Inbound: `POST /webhooks/:channelType` → adapter normalizes payload → stored as `Message` in Postgres → broadcast via Socket.IO on `conversation:CONV_ID` and `channel:CHANNEL_ID` rooms.

Outbound: `POST /api/conversations/:id/messages` → adapter sends to external API → stored → Socket.IO broadcast.

The Socket.IO server uses Redis adapter (`@socket.io/redis-adapter`) for horizontal scalability.

### Frontend State

- **Zustand** (`apps/web/src/store/index.ts`) — active conversation/channel selection, unread counts, optimistic messages.
- **TanStack Query** — server state for channels, conversations, and messages (staleTime: 5s).
- **useSocket** hook — subscribes to `message:new` and `conversation:updated` Socket.IO events, invalidates queries on receipt.

### Database Schema

Four models in `apps/api/prisma/schema.prisma`:
- `Channel` → `Conversation` (1:many) → `Message` (1:many)
- `WebhookEvent` — audit log of raw inbound payloads, linked to Channel

Conversations have a unique constraint on `(channelId, externalId)` to deduplicate across restarts.

## Environment Setup

Copy `apps/api/.env.example` to `apps/api/.env`. Required vars:
- `DATABASE_URL` — defaults to the docker-compose Postgres instance
- `REDIS_URL` — defaults to the docker-compose Redis instance
- WhatsApp vars (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`) — only needed for WhatsApp channel
- Teams vars (`TEAMS_APP_ID`, `TEAMS_TENANT_ID`, `TEAMS_CLIENT_SECRET`) — for reference only, actual config stored in DB via Settings UI

## WSL / Docker notes

- Docker must be started manually in WSL: `sudo service docker start`
- After adding user to docker group, run `newgrp docker` or restart the WSL session
- If ports 3001 or 5173 are in use: `fuser -k 3001/tcp 5173/tcp`
- `pnpm dev` starts both API and web via Turborepo; if only one dies, restart individually:
  ```bash
  pnpm --filter @messaging/api dev
  pnpm --filter @messaging/web dev
  ```

## Teams adapter — important implementation note

The `TeamsAdapter` encodes `serviceUrl` into `contactId` as `"serviceUrl::conversationId"` at webhook ingest time. This is required so `sendMessage` can reconstruct the Bot Framework endpoint. If you ever reset the database, old conversations with plain `conversationId` format (no `::`) will fail to reply — delete them and let new inbound messages recreate them.
