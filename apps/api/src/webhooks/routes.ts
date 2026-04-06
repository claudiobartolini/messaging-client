import { FastifyInstance } from "fastify";
import { registry } from "../channels/registry";

export async function webhookRoutes(app: FastifyInstance) {
  // Webhook verification (GET) - used by WhatsApp to verify the endpoint
  app.get<{ Params: { channelType: string }; Querystring: Record<string, string> }>(
    "/:channelType",
    async (request, reply) => {
      let adapter;
      try {
        adapter = registry.get(request.params.channelType);
      } catch {
        return reply.status(404).send({ error: "Unknown channel type" });
      }
      if (!adapter.verifyWebhook) return reply.status(404).send();

      // Load channel config from DB
      const channel = await (app as any).prisma.channel.findFirst({
        where: { type: request.params.channelType, isActive: true },
      });
      if (!channel) return reply.status(404).send("Channel not configured");

      const challenge = adapter.verifyWebhook(request.query, channel.config);
      if (challenge) return reply.send(challenge);

      return reply.status(403).send("Verification failed");
    }
  );

  // Inbound webhook (POST) - receives messages
  app.post<{ Params: { channelType: string } }>(
    "/:channelType",
    async (request, reply) => {
      let adapter;
      try {
        adapter = registry.get(request.params.channelType);
      } catch {
        return reply.status(404).send({ error: "Unknown channel type" });
      }

      const channel = await (app as any).prisma.channel.findFirst({
        where: { type: request.params.channelType, isActive: true },
      });
      if (!channel) return reply.status(404).send("Channel not configured");

      // Store raw webhook for audit
      await (app as any).prisma.webhookEvent.create({
        data: { channelId: channel.id, payload: request.body as object },
      });

      // Handle WhatsApp delivery/read status updates
      const body = request.body as any;
      const entries = body?.entry ?? [];
      for (const entry of entries) {
        for (const change of entry?.changes ?? []) {
          const value = change?.value;
          const statuses = value?.statuses ?? [];
          for (const s of statuses) {
            try {
              await (app as any).prisma.message.updateMany({
                where: { externalId: s.id },
                data: {
                  status: s.status,
                  deliveredAt: s.status === "delivered" ? new Date(Number(s.timestamp) * 1000) : undefined,
                  readAt: s.status === "read" ? new Date(Number(s.timestamp) * 1000) : undefined,
                },
              });
              const msg = await (app as any).prisma.message.findFirst({ where: { externalId: s.id } });
              if (msg) {
                (app as any).io.to(`conversation:${msg.conversationId}`).emit("message:updated", msg);
              }
            } catch (err) {
              app.log.error({ err, s }, "Failed to update message status");
            }
          }
        }
      }

      const normalizedMessages = await adapter.handleWebhook(request.body, channel.config);

      for (const msg of normalizedMessages) {
        try {
          // Upsert conversation
          const conversation = await (app as any).prisma.conversation.upsert({
            where: { channelId_externalId: { channelId: channel.id, externalId: msg.contactId } },
            create: {
              channelId: channel.id,
              externalId: msg.contactId,
              contact: { id: msg.contactId, name: msg.contactName },
              lastMessageAt: msg.sentAt,
              lastMessageBody: msg.body,
              unreadCount: 1,
            },
            update: {
              lastMessageAt: msg.sentAt,
              lastMessageBody: msg.body,
              unreadCount: { increment: 1 },
            },
          });

          // Save message
          const savedMessage = await (app as any).prisma.message.create({
            data: {
              conversationId: conversation.id,
              externalId: msg.externalId,
              direction: msg.direction,
              body: msg.body,
              mediaUrl: msg.mediaUrl,
              status: "delivered",
              sentAt: msg.sentAt,
            },
          });

          // Emit via Socket.IO
          (app as any).io.to(`conversation:${conversation.id}`).emit("message:new", savedMessage);
          (app as any).io.to(`channel:${channel.id}`).emit("conversation:updated", conversation);
        } catch (err) {
          app.log.error({ err, msg }, "Failed to persist inbound message");
        }
      }

      return reply.send({ status: "ok" });
    }
  );
}
