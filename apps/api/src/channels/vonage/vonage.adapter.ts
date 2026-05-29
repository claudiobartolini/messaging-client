import axios from "axios";
import { z } from "zod";
import { NormalizedMessage, OutboundMessage, SendResult, ConfigField } from "@messaging/shared";
import { ChannelAdapter } from "../base/channel.adapter";

export const VonageConfigSchema = z.object({
  apiKey: z.string(),
  apiSecret: z.string(),
  fromNumber: z.string(),
});
export type VonageConfig = z.infer<typeof VonageConfigSchema>;

export class VonageAdapter implements ChannelAdapter {
  readonly type = "vonage";
  readonly configSchema = VonageConfigSchema;

  getConfigFields(): ConfigField[] {
    return [
      { name: "apiKey", label: "Vonage API Key", type: "text", required: true },
      { name: "apiSecret", label: "Vonage API Secret", type: "password", required: true },
      { name: "fromNumber", label: "WhatsApp From Number (E.164)", type: "text", required: true },
    ];
  }

  async handleWebhook(rawPayload: unknown, _channelConfig: unknown): Promise<NormalizedMessage[]> {
    const payload = rawPayload as any;

    // Status update payloads have no `message` field — nothing to persist here
    if (!payload?.message) return [];

    const text = payload.message?.content?.text;
    if (!text) return []; // non-text message types not yet supported

    return [
      {
        externalId: payload.message_uuid,
        channelId: payload.to,
        direction: "inbound",
        contactId: payload.from,
        body: text,
        sentAt: payload.timestamp ?? new Date().toISOString(),
      },
    ];
  }

  async sendMessage(to: string, message: OutboundMessage, channelConfig: unknown): Promise<SendResult> {
    const config = VonageConfigSchema.parse(channelConfig);
    const credentials = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64");

    const response = await axios.post(
      "https://api.nexmo.com/v1/messages",
      {
        channel: "whatsapp",
        message_type: "text",
        to,
        from: config.fromNumber,
        text: message.body,
      },
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      externalId: response.data.message_uuid ?? "",
      status: "sent",
    };
  }
}
