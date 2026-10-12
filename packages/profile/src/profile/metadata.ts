import { z } from "zod";

const opaqueHashSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const profileImportReferenceSchema = z.object({
  repositoryAliases: z.array(opaqueHashSchema).min(1),
  sourceLocator: opaqueHashSchema,
});
