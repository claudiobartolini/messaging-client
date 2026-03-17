import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { registry } from "./channels/registry";
import { WhatsAppAdapter } from "./channels/whatsapp/whatsapp.adapter";
import { webhookRoutes } from "./webhooks/routes";
import { channelRoutes } from "./settings/channel.routes";
import { conversationRoutes } from "./conversations/routes";

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

// Register adapters
registry.register(new WhatsAppAdapter());

// Plugins
await app.register(cors, { origin: true });

// Socket.IO
const io = new Server(app.server, { cors: { origin: "*" } });
app.decorate("io", io);
app.decorate("prisma", prisma);

// Routes
await app.register(webhookRoutes, { prefix: "/webhooks" });
await app.register(channelRoutes, { prefix: "/api/channels" });
await app.register(conversationRoutes, { prefix: "/api/conversations" });

app.get("/health", async () => ({ status: "ok" }));

io.on("connection", (socket) => {
  app.log.info(`Socket connected: ${socket.id}`);

  socket.on("join:conversation", (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on("leave:conversation", (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on("disconnect", () => {
    app.log.info(`Socket disconnected: ${socket.id}`);
  });
});

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "0.0.0.0" });
console.log(`API running on http://localhost:${port}`);
