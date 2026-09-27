import { z } from "zod";

export const descriptionSchema = z.strictObject({
  title: z.string().min(1).max(80),
  summary: z.string().min(1).max(600),
  strengths: z.array(z.string().min(1).max(180)).max(3),
  tradeoffs: z.array(z.string().min(1).max(180)).max(3),
});

export const descriptionReviewSchema = z.strictObject({
  id: z.uuid(),
  destination: z.string(),
  payload: z.string(),
  limits: z.string(),
  cached: descriptionSchema.nullable(),
});

export const descriptionResultSchema = z.strictObject({
  description: descriptionSchema,
});

export type BuildDescription = z.infer<typeof descriptionSchema>;
