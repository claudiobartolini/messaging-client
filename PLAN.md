# Plan: Post Conversation Turns to Sarah (with at-least-once delivery)

## Context

Sarah (voice co-pilot) processes conversation turns and provides intelligence (summaries, suggestions, sentiment, RAG). We want to feed every messaging turn (inbound or outbound, any channel) to Sarah in the same format it uses for voice turns.

We also want a lightweight delivery guarantee: if Sarah's endpoint is down or slow, we don't drop the turn, and we don't block the main message flow.

**Approach:** BullMQ job queue (already installed, not yet used) backed by the existing Redis instance. Each turn is enqueued as a job with `jobId = messageId`. BullMQ handles retries with exponential backoff. The `messageId` in the payload lets Sarah deduplicate on its end, giving effectively-exactly-once semantics end-to-end.

No DB changes, no auth changes, no UI changes.

---

## Delivery guarantee design

| Property | How |
|----------|-----|
| At-least-once | BullMQ retries failed jobs (non-2xx or network error) up to N times |
| Deduplication (our side) | `jobId: messageId` — BullMQ won't enqueue a duplicate job while one with that ID is waiting/active/delayed |
| Deduplication (Sarah's side) | `messageId` is in every payload — Sarah can deduplicate on receipt |
| Persistence | Jobs survive API restarts (stored in Redis) |
| Non-blocking | Enqueue is sync (sub-millisecond Redis write); delivery happens in the Worker, not the HTTP handler |

Retry config: 5 attempts, exponential backoff starting at 2 s → 2, 4, 8, 16, 32 s. After all attempts fail, job moves to the BullMQ failed set (visible in any BullMQ dashboard).

---

## Implementation

### 1. New file: `apps/api/src/services/sarah.ts`

Creates the Queue, the Worker, and exports the enqueue function.

```ts
import { Queue, Worker } from "bullmq";
import Redis from "ioredis";

const SARAH_WEBHOOK_URL = process.env.SARAH_WEBHOOK_URL;

// Separate ioredis connection for BullMQ (required — cannot share with Socket.IO adapter)
const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export const sarahQueue = new Queue("sarah-turns", { connection });

new Worker(
  "sarah-turns",
  async (job) => {
    if (!SARAH_WEBHOOK_URL) return;
    const res = await fetch(SARAH_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job.data),
    });
    if (!res.ok) throw new Error(`Sarah webhook returned ${res.status}`);
  },
  {
    connection,
    concurrency: 5,
  }
);

export function notifySarah(payload: {
  channelType: string;
  channelId: string;
  conversationId: string;
  turn: "inbound" | "outbound";
  body: string;
  contact: Record<string, unknown>;
  sentAt: Date | string;
  messageId: string;
}) {
  if (!SARAH_WEBHOOK_URL) return;
  sarahQueue.add("turn", payload, {
    jobId: payload.messageId,          // deduplication key
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 100,                 // keep last 100 failed jobs for inspection
  });
}
```

**Note:** `maxRetriesPerRequest: null` is required by BullMQ on the ioredis connection.

---

### 2. Inbound turns — `apps/api/src/webhooks/routes.ts`

After the two existing `io.to()` emits, add:

```ts
import { notifySarah } from "../services/sarah.js";

// inside the for-loop, after both io.to() calls:
notifySarah({
  channelType: channel.type,
  channelId: channel.id,
  conversationId: conversation.id,
  turn: "inbound",
  body: savedMessage.body ?? "",
  contact: conversation.contact as Record<string, unknown>,
  sentAt: savedMessage.sentAt,
  messageId: savedMessage.id,
});
```

Variables already in scope: `channel`, `conversation`, `savedMessage`.

---

### 3. Outbound turns — `apps/api/src/conversations/routes.ts`

In the existing `POST /:id/messages` handler, after the message is saved and emitted, add:

```ts
import { notifySarah } from "../services/sarah.js";

notifySarah({
  channelType: conversation.channel.type,   // already selected via include
  channelId: conversation.channelId,
  conversationId: conversation.id,
  turn: "outbound",
  body: savedMessage.body ?? "",
  contact: conversation.contact as Record<string, unknown>,
  sentAt: savedMessage.sentAt,
  messageId: savedMessage.id,
});
```

---

### 4. `apps/api/.env.example`

```
# Sarah co-pilot webhook — omit to disable turn forwarding
SARAH_WEBHOOK_URL=
```

---

## Files changed

| File | Change |
|------|--------|
| `apps/api/src/services/sarah.ts` | New — Queue, Worker, notifySarah() |
| `apps/api/src/webhooks/routes.ts` | Call notifySarah after inbound message upsert |
| `apps/api/src/conversations/routes.ts` | Call notifySarah after outbound message saved |
| `apps/api/.env.example` | Add SARAH_WEBHOOK_URL |

---

## Mock server for testing

```bash
node -e "
const http = require('http');
http.createServer((req, res) => {
  let b = '';
  req.on('data', d => b += d);
  req.on('end', () => { console.log(JSON.parse(b)); res.end('ok'); });
}).listen(4000, () => console.log('mock sarah on :4000'));
"
```

Set `SARAH_WEBHOOK_URL=http://localhost:4000` and restart the API.

---

## Verification

1. Start mock server on :4000, set `SARAH_WEBHOOK_URL=http://localhost:4000`
2. Send an inbound WhatsApp message → mock logs a turn with `"turn": "inbound"`, `"channelType": "vonage"`
3. Reply from the web UI → mock logs `"turn": "outbound"`
4. Stop the mock server, send a message → job queued in Redis; restart mock → job delivered on retry
5. Send duplicate (same `messageId`) → only one job in BullMQ (deduplication)
6. Repeat for Teams channel — same payload shape, `"channelType": "teams"`
