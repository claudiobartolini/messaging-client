import { z } from "zod";

export const ChannelTypeSchema = z.enum(["whatsapp", "teams"]);
export type ChannelType = z.infer<typeof ChannelTypeSchema>;

export const ConfigFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum(["text", "password", "url"]),
  required: z.boolean(),
});
export type ConfigField = z.infer<typeof ConfigFieldSchema>;

export const ChannelSchema = z.object({
  id: z.string(),
  type: ChannelTypeSchema,
  name: z.string(),
  config: z.record(z.string()),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type Channel = z.infer<typeof ChannelSchema>;
