import { FastifyInstance } from "fastify";
import { registry } from "../channels/registry";

export async function conversationRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // List conversations
  app.get<{ Querystring: { channelId?: string; page?: string } }>("/", async (request) => {
    const { channelId, page = "1" } = request.query;
    const take = 20;
    const skip = (Number(page) - 1) * take;

    const conversations = await prisma.conversation.findMany({
      where: channelId ? { channelId } : undefined,
      orderBy: { lastMessageAt: "desc" },
      take,
      skip,
      include: { channel: { select: { type: true, name: true } } },
    });
    return conversations;
  });

  // Get messages for a conversation
  app.get<{ Params: { id: string }; Querystring: { page?: string } }>(
    "/:id/messages",
    async (request) => {
      const take = 50;
      const skip = (Number(request.query.page ?? 1) - 1) * take;

      const messages = await prisma.message.findMany({
        where: { conversationId: request.params.id },
        orderBy: { sentAt: "asc" },
        take,
        skip,
      });

      // Mark as read
      await prisma.conversation.update({
        where: { id: request.params.id },
        data: { unreadCount: 0 },
      });

      return messages;
    }
  );

  // Send a message
  app.post<{ Params: { id: string }; Body: { body: string } }>(
    "/:id/messages",
    async (request, reply) => {
      try {
        const conversation = await prisma.conversation.findUniqueOrThrow({
          where: { id: request.params.id },
          include: { channel: true },
        });

        const adapter = registry.get(conversation.channel.type);
        const result = await adapter.sendMessage(
          (conversation.contact as any).id,
          { body: request.body.body },
          conversation.channel.config
        );

        const message = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            externalId: result.externalId,
            direction: "outbound",
            body: request.body.body,
            status: result.status,
            sentAt: new Date().toISOString(),
          },
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date(), lastMessageBody: request.body.body },
        });

        (app as any).io.to(`conversation:${conversation.id}`).emit("message:new", message);

        return reply.status(201).send(message);
      } catch (err: any) {
        if (err?.code === "P2025") throw err; // let global handler return 404
        app.log.error(err, "sendMessage failed");
        return reply.status(502).send({ error: "Failed to deliver message" });
      }
    }
  );
}
