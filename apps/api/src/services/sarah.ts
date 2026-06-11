import { Queue, Worker } from "bullmq";

function redisConnection() {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port) : 6379,
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    maxRetriesPerRequest: null as null,
  };
}

const sarahQueue = new Queue("sarah-turns", {
  connection: redisConnection(),
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
  },
});

const worker = new Worker(
  "sarah-turns",
  async (job) => {
    const url = process.env.SARAH_WEBHOOK_URL!;
    console.log(`[sarah] processing job ${job.id}, posting to ${url}`);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(job.data),
    });
    if (!res.ok) throw new Error(`Sarah responded ${res.status}`);
    console.log(`[sarah] job ${job.id} delivered`);
  },
  { connection: redisConnection() }
);

worker.on("error", (err) => console.error("[sarah] worker error:", err));
worker.on("failed", (job, err) => console.error(`[sarah] job ${job?.id} failed:`, err.message));

export interface SarahTurnPayload {
  messageId: string;
  conversationId: string;
  channelType: string;
  direction: "inbound" | "outbound";
  contact: string;
  body: string;
  timestamp: Date;
}

export async function notifySarah(payload: SarahTurnPayload) {
  if (!process.env.SARAH_WEBHOOK_URL) return;
  console.log(`[sarah] enqueuing turn for message ${payload.messageId}`);
  await sarahQueue.add("turn", payload, { jobId: payload.messageId });
}
