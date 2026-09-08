import { z } from "zod";
import type { ProfileSection } from "../profile";

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const seedSkillMetadataSchema = z.strictObject({
  id: slugSchema,
  title: z.string().trim().min(1),
  axis: slugSchema.nullable(),
  category: slugSchema,
  section: z.enum(["engineering", "workflow", "boundaries"]),
  "applies-when": z.array(z.string().trim().min(1)).min(1),
});

export type SeedSkill = {
  readonly id: string;
  readonly title: string;
  readonly axis: string | null;
  readonly category: string;
  readonly section: ProfileSection;
  readonly appliesWhen: readonly string[];
  readonly body: string;
};

export type SeedSkillAxis = {
  readonly id: string;
  readonly skills: readonly SeedSkill[];
};

export type SeedSkillLibrary = {
  readonly skills: readonly SeedSkill[];
  readonly axes: readonly SeedSkillAxis[];
  readonly disciplines: readonly SeedSkill[];
};
