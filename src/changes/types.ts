import { z } from "zod";

export const revisionSchema = z.strictObject({
  id: z.uuid(),
  kind: z.enum(["profile", "skill"]),
  root: z.string().min(1),
  createdAt: z.number(),
  status: z.enum(["prepared", "applied"]),
  changes: z.array(z.strictObject({ relativePath: z.string().min(1), before: z.string().nullable(), after: z.string().nullable() })).max(256),
});
export type LocalRevision = z.infer<typeof revisionSchema>;
export type FileUpdate = { readonly filePath: string; readonly next: string | null; readonly previous?: string | null };
