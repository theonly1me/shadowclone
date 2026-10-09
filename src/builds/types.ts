import { z } from "zod";
import type { FileUpdate } from "../changes";
import type { ProjectPaths } from "../paths";
import type { EnvironmentState } from "../environment/types";
import type { DiscoveredSkill } from "../skillMaintenance/types";

export const buildScopeSchema = z.enum(["global", "private", "shared"]);
const nameSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(48);
export const customSkillSchema = z.strictObject({
  name: nameSchema,
  description: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(24_000),
});

export const buildInputSchema = z.strictObject({
  scope: buildScopeSchema,
  choices: z.record(z.string().max(128), z.boolean()),
  edits: z
    .record(z.string().max(128), z.string().min(1).max(48_000))
    .default({}),
  custom: z.array(customSkillSchema).max(40).default([]),
});

export const buildDefinitionSchema = buildInputSchema.extend({
  directory: z.string(),
  id: z.string(),
});

export type BuildInput = z.infer<typeof buildInputSchema>;

export type BuildDefinition = z.infer<typeof buildDefinitionSchema>;

export type BuildScope = BuildInput["scope"];

export type BuildContext = {
  readonly paths: ProjectPaths;
  readonly cwd: string;
};

export type BuildItem = {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly text: string;
  readonly kind: "preference" | "skill";
  readonly category: string | null;
  readonly section: string | null;
  readonly axis: string | null;
  readonly alwaysOn: boolean;
  readonly owner: "packaged" | "managed" | "user" | "provider";
  readonly source?: DiscoveredSkill;
};

export type BuildPlan = {
  readonly input: BuildInput;
  readonly state: EnvironmentState;
  readonly updates: readonly FileUpdate[];
  readonly warnings: readonly string[];
  readonly observed: readonly {
    readonly filePath: string;
    readonly text: string | null;
  }[];
};
