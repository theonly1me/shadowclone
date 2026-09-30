import { z } from "zod";
import { remoteDraftSchema } from "../dispatch/remoteActions";

export const taskActionInputSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("commit"),
    subject: z
      .string()
      .regex(/^[a-z]+(?:\([a-z0-9-]+\))?: [^\r\n]+$/)
      .max(200),
  }),
  z.strictObject({ action: z.literal("push") }),
  z.strictObject({
    action: z.literal("pr-create"),
    ...remoteDraftSchema.shape,
    draft: z.boolean().default(true),
  }),
  z.strictObject({
    action: z.literal("pr-reply"),
    body: z.string().min(1).max(65_000),
  }),
  z.strictObject({ action: z.literal("merge") }),
]);

export type TaskActionInput = z.infer<typeof taskActionInputSchema>;
