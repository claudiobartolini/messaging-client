import { FastifyInstance } from "fastify";

export async function internalRoutes(app: FastifyInstance) {
  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/conversations/:id/suggestions",
    async (request, reply) => {
      const payload = { ...request.body, conversationId: request.params.id };
      (app as any).io.emit("suggestion:new", payload);
      return reply.send({ status: "ok" });
    }
  );
}
