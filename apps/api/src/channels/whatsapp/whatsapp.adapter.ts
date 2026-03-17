import axios from "axios";
import { z } from "zod";
import { NormalizedMessage, OutboundMessage, SendResult, ConfigField } from "@messaging/shared";
import { ChannelAdapter } from "../base/channel.adapter";

export const WhatsAppConfigSchema = z.object({
  accessToken: z.string(),
  phoneNumberId: z.string(),
  verifyToken: z.string(),
  apiVersion: z.string().default("v19.0"),
});
export type WhatsAppConfig = z.infer<typeof WhatsAppConfigSchema>;

export class WhatsAppAdapter implements ChannelAdapter {
  readonly type = "whatsapp";
  readonly configSchema = WhatsAppConfigSchema;

  getConfigFields(): ConfigField[] {
    return [
      { name: "accessToken", label: "Access Token", type: "password", required: true },
      { name: "phoneNumberId", label: "Phone Number ID", type: "text", required: true },
      { name: "verifyToken", label: "Webhook Verify Token", type: "password", required: true },
      { name: "apiVersion", label: "API Version", type: "text", required: false },
    ];
  }

  verifyWebhook(query: Record<string, string>, channelConfig: unknown): string | null {
    const config = WhatsAppConfigSchema.parse(channelConfig);
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (mode === "subscribe" && token === config.verifyToken) {
      return challenge ?? null;
    }
    return null;
  }

  async handleWebhook(rawPayload: unknown, channelConfig: unknown): Promise<NormalizedMessage[]> {
    const config = WhatsAppConfigSchema.parse(channelConfig);
    const payload = rawPayload as any;
    const messages: NormalizedMessage[] = [];

    const entries = payload?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages) continue;

        for (const msg of value.messages) {
          if (msg.type !== "text") continue; // handle only text for now

          messages.push({
            externalId: msg.id,
            channelId: config.phoneNumberId,
            direction: "inbound",
            contactId: msg.from,
            contactName: value.contacts?.find((c: any) => c.wa_id === msg.from)?.profile?.name,
            body: msg.text?.body ?? "",
            sentAt: new Date(Number(msg.timestamp) * 1000).toISOString(),
          });
        }
      }
    }

    return messages;
  }

  async sendMessage(to: string, message: OutboundMessage, channelConfig: unknown): Promise<SendResult> {
    const config = WhatsAppConfigSchema.parse(channelConfig);
    const url = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;

    const response = await axios.post(
      url,
      {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message.body },
      },
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      externalId: response.data.messages?.[0]?.id ?? "",
      status: "sent",
    };
  }
}
