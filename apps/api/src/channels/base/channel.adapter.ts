import { ZodSchema } from "zod";
import { NormalizedMessage, OutboundMessage, SendResult, ConfigField } from "@messaging/shared";

export interface ChannelAdapter {
  readonly type: string;
  readonly configSchema: ZodSchema;

  handleWebhook(rawPayload: unknown, channelConfig: unknown): Promise<NormalizedMessage[]>;
  sendMessage(to: string, message: OutboundMessage, channelConfig: unknown): Promise<SendResult>;
  verifyWebhook?(query: Record<string, string>, channelConfig: unknown): string | null;
  getConfigFields(): ConfigField[];
}
