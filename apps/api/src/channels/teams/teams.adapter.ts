import axios from "axios";
import { z } from "zod";
import { NormalizedMessage, OutboundMessage, SendResult, ConfigField } from "@messaging/shared";
import { ChannelAdapter } from "../base/channel.adapter";

export const TeamsConfigSchema = z.object({
  appId: z.string(),
  tenantId: z.string(),
  clientSecret: z.string(),
});
export type TeamsConfig = z.infer<typeof TeamsConfigSchema>;

export class TeamsAdapter implements ChannelAdapter {
  readonly type = "teams";
  readonly configSchema = TeamsConfigSchema;

  getConfigFields(): ConfigField[] {
    return [
      { name: "appId", label: "Microsoft App ID", type: "text", required: true },
      { name: "tenantId", label: "App Tenant ID", type: "text", required: true },
      { name: "clientSecret", label: "Client Secret", type: "password", required: true },
    ];
  }

  async handleWebhook(rawPayload: unknown, _channelConfig: unknown): Promise<NormalizedMessage[]> {
    const activity = rawPayload as any;

    if (activity.type !== "message" || !activity.text) return [];

    const contactId = activity.from?.id ?? "unknown";
    const contactName = activity.from?.name;
    const conversationId = activity.conversation?.id ?? contactId;

    return [
      {
        externalId: activity.id,
        channelId: activity.channelId ?? "msteams",
        direction: "inbound",
        contactId: conversationId,
        contactName,
        body: activity.text,
        sentAt: activity.timestamp ?? new Date().toISOString(),
        metadata: {
          serviceUrl: activity.serviceUrl,
          conversationId: activity.conversation?.id,
          botId: activity.recipient?.id,
        },
      },
    ];
  }

  async sendMessage(to: string, message: OutboundMessage, channelConfig: unknown): Promise<SendResult> {
    const config = TeamsConfigSchema.parse(channelConfig);

    // Get bot token from Azure AD
    const tokenRes = await axios.post(
      `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.appId,
        scope: "https://api.botframework.com/.default",
        client_secret: config.clientSecret,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenRes.data.access_token;

    // `to` is encoded as "serviceUrl::conversationId"
    const [serviceUrl, conversationId] = to.split("::");

    const response = await axios.post(
      `${serviceUrl}v3/conversations/${conversationId}/activities`,
      {
        type: "message",
        text: message.body,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      externalId: response.data.id ?? "",
      status: "sent",
    };
  }
}
