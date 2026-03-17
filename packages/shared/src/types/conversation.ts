import { z } from "zod";

export const ConversationSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  externalId: z.string(),
  contact: z.object({
    id: z.string(),
    name: z.string().optional(),
    phone: z.string().optional(),
  }),
  lastMessageAt: z.string(),
  lastMessageBody: z.string().optional(),
  unreadCount: z.number().default(0),
});
export type Conversation = z.infer<typeof ConversationSchema>;
