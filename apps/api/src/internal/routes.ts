import { FastifyInstance } from "fastify";

export async function internalRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/conversations/:id/suggestions",
    async (request, reply) => {
      const payload = { ...request.body, conversationId: request.params.id };
      (app as any).io.to(`conversation:${request.params.id}`).emit("suggestion:new", payload);
      app.log.info({ conversationId: request.params.id }, "suggestion:new emitted");
      return reply.send({ status: "ok" });
    }
  );
}
