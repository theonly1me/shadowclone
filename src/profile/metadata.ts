import { z } from "zod";
import type { ProfileEvidence } from "./types";

const profileSourceSchema = z.enum([
  "declared",
  "imported",
  "mined",
  "user",
]);
const profileStatusSchema = z.enum(["active", "candidate", "stale"]);
const profileProposalSchema = z
  .object({
    kind: z.enum(["revise", "narrow", "retire"]),
    text: z.string(),
  })
  .nullable();
const profileEvidenceSchema = z.object({
  for: z.array(z.string()),
  against: z.array(z.string()),
});

export const profileRuleSchema = z.object({
  key: z.string().min(1),
  title: z.string(),
  body: z.string(),
  section: z.enum(["engineering", "workflow", "boundaries"]),
  scope: z.enum(["global", "org"]),
  originDirectory: z.string().nullable(),
  source: profileSourceSchema,
  status: profileStatusSchema,
  proposal: profileProposalSchema,
  appliesWhen: z.array(z.string()),
  evidence: profileEvidenceSchema,
  observations: z.number().int().nonnegative(),
  lastSeen: z.string(),
  sessions: z.number().int().nonnegative(),
  origins: z.array(z.string()),
});

export const profileMetadataSchema = z.object({
  schema: z.literal(1),
  key: z.string().min(1),
  source: profileSourceSchema,
  status: profileStatusSchema,
  proposal: profileProposalSchema,
  "applies-when": z.array(z.string()),
  supports: z.number().int().nonnegative(),
  contradicts: z.number().int().nonnegative(),
  evidence: profileEvidenceSchema,
  observations: z.number().int().nonnegative(),
  "last-seen": z.string(),
  sessions: z.number().int().nonnegative(),
  origins: z.array(z.string()),
  scope: z.enum(["global", "org"]),
  fingerprint: z.string().min(1),
});

export function uniqueProfileEvidence(
  evidence: ProfileEvidence,
): ProfileEvidence {
  return {
    for: [...new Set(evidence.for)],
    against: [...new Set(evidence.against)],
  };
}

export function encodeProfileMetadata(value: object): string {
  return JSON.stringify(value).replaceAll("--", "\\u002d\\u002d");
}
