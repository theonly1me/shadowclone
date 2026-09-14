import { z } from "zod";

export const skillRootSchema = z.strictObject({
  id: z.string().regex(/^[a-f0-9]{64}$/), directory: z.string(), cwd: z.string(),
  scope: z.enum(["global", "repository"]), owner: z.enum(["user", "third-party"]), destination: z.string(), enabled: z.boolean().optional().default(true),
});
export type SkillRoot = z.infer<typeof skillRootSchema>;
export const trackedSkillSchema = z.strictObject({
  id: z.string(), rootId: z.string(), relativePath: z.string(), fingerprint: z.string(),
  kind: z.enum(["amend", "companion"]), automatic: z.boolean(),
});
export const maintenanceStateSchema = z.strictObject({
  version: z.literal(1), roots: z.array(skillRootSchema).max(64),
  tracked: z.array(trackedSkillSchema), assessed: z.record(z.string(), z.string()),
  findings: z.record(z.string(), z.array(z.string())).optional().default({}),
  rejected: z.record(z.string(), z.array(z.string())).optional().default({}),
});
export type MaintenanceState = z.infer<typeof maintenanceStateSchema>;
export const proposalSchema = z.strictObject({
  id: z.uuid(), rootId: z.string(), skillId: z.string(), sourceRelativePath: z.string(), sourceFingerprint: z.string(),
  targetRelativePath: z.string(), kind: z.enum(["amend", "companion"]), before: z.string().nullable(), after: z.string(),
  findings: z.array(z.string()), status: z.enum(["pending", "applied", "rejected"]), createdAt: z.number(), inputFingerprint: z.string(),
});
export type SkillProposal = z.infer<typeof proposalSchema>;
export type DiscoveredSkill = {
  readonly id: string; readonly root: SkillRoot; readonly relativePath: string;
  readonly raw: string; readonly redacted: string; readonly fingerprint: string;
  readonly name: string; readonly description: string; readonly body: string;
};
