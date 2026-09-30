import { z } from "zod";

export const taskSummarySchema = z.array(
  z.strictObject({
    id: z.uuid(),
    title: z.string(),
    state: z.string(),
    host: z.string(),
    parentId: z.string().nullable(),
    updatedAt: z.string(),
    verification: z.string(),
    review: z.boolean().nullable(),
    finish: z.string(),
    interruptedActions: z.number(),
  }),
);
