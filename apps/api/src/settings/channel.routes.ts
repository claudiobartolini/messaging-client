import { FastifyInstance } from "fastify";
import { registry } from "../channels/registry";

export async function channelRoutes(app: FastifyInstance) {
  const prisma = (app as any).prisma;

  // List all channels + available types
  app.get("/", async () => {
    const channels = await prisma.channel.findMany({ orderBy: { createdAt: "asc" } });
    const availableTypes = registry.getAll().map((a) => ({
      type: a.type,
      fields: a.getConfigFields(),
    }));
    return { channels, availableTypes };
  });

  // Add a channel
  app.post<{ Body: { type: string; name: string; config: Record<string, string> } }>(
    "/",
    async (request, reply) => {
      const { type, name, config } = request.body;
      const adapter = registry.get(type);
      adapter.configSchema.parse(config); // validate config

      const channel = await prisma.channel.create({ data: { type, name, config } });
      return reply.status(201).send(channel);
    }
  );

  // Update a channel
  app.put<{ Params: { id: string }; Body: { name?: string; config?: Record<string, string>; isActive?: boolean } }>(
    "/:id",
    async (request, reply) => {
      const channel = await prisma.channel.update({
        where: { id: request.params.id },
        data: request.body,
      });
      return reply.send(channel);
    }
  );

  // Delete a channel and all related data
  app.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const { id } = request.params;
    const conversations = await prisma.conversation.findMany({ where: { channelId: id }, select: { id: true } });
    const conversationIds = conversations.map((c: { id: string }) => c.id);

    await prisma.$transaction([
      prisma.message.deleteMany({ where: { conversationId: { in: conversationIds } } }),
      prisma.conversation.deleteMany({ where: { channelId: id } }),
      prisma.webhookEvent.deleteMany({ where: { channelId: id } }),
      prisma.channel.delete({ where: { id } }),
    ]);

    return reply.status(204).send();
  });
}
