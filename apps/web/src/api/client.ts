const BASE = "/api";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (options?.body) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getChannels: () => req<{ channels: any[]; availableTypes: any[] }>("/channels"),
  createChannel: (body: { type: string; name: string; config: Record<string, string> }) =>
    req("/channels", { method: "POST", body: JSON.stringify(body) }),
  updateChannel: (id: string, body: object) =>
    req(`/channels/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteChannel: (id: string) =>
    req(`/channels/${id}`, { method: "DELETE" }),

  getConversations: (channelId?: string) =>
    req<any[]>(`/conversations${channelId ? `?channelId=${channelId}` : ""}`),
  getMessages: (conversationId: string) =>
    req<any[]>(`/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, body: string) =>
    req(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
};
