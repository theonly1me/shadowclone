import type { ProjectPaths } from "@shadowclone/core";
import {
  ensureSkillsRepository,
  exportGuidance,
  ghApiCall,
  pushSkills,
  setupSelection,
} from "@shadowclone/bot";
import { z } from "zod";

export type SkillsPushOutcome =
  | {
      readonly kind: "needs-approval";
      readonly skillsRepository: string;
      readonly files: readonly { readonly path: string; readonly bytes: number }[];
      readonly leftOut: readonly string[];
    }
  | {
      readonly kind: "pushed" | "unchanged";
      readonly skillsRepository: string;
      readonly leftOut: readonly string[];
    };

export async function pushCloneSkills(options: {
  readonly paths: ProjectPaths;
  readonly cwd: string;
  readonly approve: boolean;
}): Promise<SkillsPushOutcome> {
  const owner = z
    .object({ login: z.string() })
    .parse((await ghApiCall({ route: "user" })).data).login;
  const { skills, leftOut } = await setupSelection({ paths: options.paths, cwd: options.cwd });

  if (skills.length === 0) {
    throw new Error(
      "No equipped skills apply here. Run shadowclone wizard and equip a build first.",
    );
  }

  const delivery = await exportGuidance({ paths: options.paths, cwd: options.cwd, skills });
  const skillsRepository = `${owner}/shadowclone-skills`;

  if (!options.approve) {
    return {
      kind: "needs-approval",
      skillsRepository,
      files: delivery.files.map((file) => ({
        path: file.path,
        bytes: Buffer.from(file.content, "base64").length,
      })),
      leftOut,
    };
  }

  const repository = await ensureSkillsRepository({ call: ghApiCall, owner });
  const pushed = await pushSkills({ call: ghApiCall, repository, files: delivery.files });

  return { kind: pushed, skillsRepository: repository, leftOut };
}
