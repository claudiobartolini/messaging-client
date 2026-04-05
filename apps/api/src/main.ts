import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fjwt from "@fastify/jwt";
import jwksClient from "jwks-rsa";
import { Server } from "socket.io";
import { PrismaClient, Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { registry } from "./channels/registry";
import { WhatsAppAdapter } from "./channels/whatsapp/whatsapp.adapter";
import { TeamsAdapter } from "./channels/teams/teams.adapter";
import { webhookRoutes } from "./webhooks/routes";
import { channelRoutes } from "./settings/channel.routes";
import { conversationRoutes } from "./conversations/routes";

async function start() {
  const prisma = new PrismaClient();
  const app = Fastify({ logger: true });

  // Register adapters
  registry.register(new WhatsAppAdapter());
  registry.register(new TeamsAdapter());

  // Plugins
  await app.register(cors, { origin: true });

  // JWT / Keycloak
  const keycloakUrl = process.env.KEYCLOAK_URL ?? "https://your-keycloak-host";
  const keycloakRealm = process.env.KEYCLOAK_REALM ?? "your-realm";
  const jwks = jwksClient({
    jwksUri: `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/certs`,
    cache: true,
    rateLimit: true,
  });
  await app.register(fjwt, {
    secret: (_request: unknown, token: { header: { kid?: string } }, callback: (err: Error | null, secret?: string) => void) => {
      jwks.getSigningKey(token.header.kid, (err, key) => {
        callback(err, key?.getPublicKey());
      });
    },
    verify: { algorithms: ["RS256"] },
  });

  app.setErrorHandler(async (error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: "Validation failed", details: error.flatten().fieldErrors });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return reply.status(404).send({ error: "Not found" });
      if (error.code === "P2002") return reply.status(409).send({ error: "Already exists" });
    }
    app.log.error(error);
    const status = (error as any).statusCode ?? 500;
    return reply.status(status >= 400 ? status : 500).send({ error: error.message ?? "Internal server error" });
  });

  const authDisabled = !process.env.KEYCLOAK_URL || process.env.KEYCLOAK_URL === "https://your-keycloak-host";

  app.addHook("onRequest", async (request, reply) => {
    if (authDisabled) return;
    if (request.url.startsWith("/api/")) {
      try {
        await request.jwtVerify();
      } catch {
        reply.status(401).send({ error: "Unauthorized" });
      }
    }
  });

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
}

start().catch(console.error);
