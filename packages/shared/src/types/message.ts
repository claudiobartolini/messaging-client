import { z } from "zod";

export const MessageDirectionSchema = z.enum(["inbound", "outbound"]);
export type MessageDirection = z.infer<typeof MessageDirectionSchema>;

export const MessageStatusSchema = z.enum(["sent", "delivered", "read", "failed"]);
export type MessageStatus = z.infer<typeof MessageStatusSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  externalId: z.string().optional(),
  direction: MessageDirectionSchema,
  body: z.string(),
  mediaUrl: z.string().optional(),
  status: MessageStatusSchema,
  sentAt: z.string(),
  deliveredAt: z.string().optional(),
  readAt: z.string().optional(),
});
export type Message = z.infer<typeof MessageSchema>;

export const NormalizedMessageSchema = z.object({
  externalId: z.string(),
  channelId: z.string(),
  direction: MessageDirectionSchema,
  contactId: z.string(),   // phone number, user ID, etc.
  contactName: z.string().optional(),
  body: z.string(),
  mediaUrl: z.string().optional(),
  sentAt: z.string(),
});
export type NormalizedMessage = z.infer<typeof NormalizedMessageSchema>;

export const OutboundMessageSchema = z.object({
  body: z.string(),
  mediaUrl: z.string().optional(),
});
export type OutboundMessage = z.infer<typeof OutboundMessageSchema>;

export const SendResultSchema = z.object({
  externalId: z.string(),
  status: MessageStatusSchema,
});
export type SendResult = z.infer<typeof SendResultSchema>;
