import { z } from "zod";
import type { ProfileSection } from "../profile";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const profileSectionSchema = z.enum([
  "engineering",
  "workflow",
  "boundaries",
]);

export const seedPreferenceMetadataSchema = z.strictObject({
  id: slugSchema,
  title: z.string().trim().min(1),
  axis: slugSchema,
  category: slugSchema,
  section: profileSectionSchema,
  "applies-when": z.array(z.string().trim().min(1)).min(1),
});

export const seedAgentSkillMetadataSchema = z.strictObject({
  name: slugSchema.max(64),
  description: z.string().trim().min(1).max(1024),
  metadata: z.strictObject({
    "shadowclone-category": slugSchema,
    "shadowclone-section": profileSectionSchema,
    "shadowclone-applies-when": z.string().trim().min(1),
    "shadowclone-axis": slugSchema.optional(),
  }),
});

type SeedGuidanceFields = {
  readonly id: string;
  readonly title: string;
  readonly axis: string | null;
  readonly category: string;
  readonly section: ProfileSection;
  readonly appliesWhen: readonly string[];
  readonly body: string;
};

export type SeedPreference = SeedGuidanceFields & {
  readonly kind: "preference";
};

export type SeedAgentSkill = SeedGuidanceFields & {
  readonly kind: "skill";
  readonly description: string;
};

export type SeedGuidance = SeedPreference | SeedAgentSkill;

export type SeedGuidanceAxis = {
  readonly id: string;
  readonly guidance: readonly SeedGuidance[];
};

export type SeedLibrary = {
  readonly guidance: readonly SeedGuidance[];
  readonly preferences: readonly SeedPreference[];
  readonly skills: readonly SeedAgentSkill[];
  readonly axes: readonly SeedGuidanceAxis[];
  readonly independentSkills: readonly SeedAgentSkill[];
};
