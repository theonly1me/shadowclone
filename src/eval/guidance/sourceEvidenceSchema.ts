import { z } from "zod";

export const sourcePacketSchema = z.strictObject({
  commit: z.string(),
  documents: z.array(z.strictObject({ id: z.string(), contentHash: z.string(), numberedContent: z.string() })).length(6),
  locations: z.array(z.strictObject({ path: z.string(), exists: z.boolean() })).length(4),
});
export type SourcePacket = z.infer<typeof sourcePacketSchema>;
export const sourceJudgingSchema = z.strictObject({
  version: z.union([z.literal(3), z.literal(4)]), promptFingerprint: z.string(), packetFingerprint: z.string(), packet: sourcePacketSchema,
  provenance: z.array(z.strictObject({ id: z.string(), path: z.string(), sourceHash: z.string() })).length(6),
});
export type SourceJudging = z.infer<typeof sourceJudgingSchema>;
