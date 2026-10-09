import path from "node:path";
import type { FileUpdate } from "@shadowclone/changes";
import { renderSkillRouting } from "../environment/context";
import type { EnvironmentState } from "../environment/types";
import { updateManagedSection } from "../integrations/markdown";
import { readLocalText } from "@shadowclone/core";
import { planBuildIntegrations } from "../environment/builds/integrations";
import { renderBuildRouting } from "../environment/builds/routing";
import type { BuildContext, BuildDefinition } from "../environment/builds/definition";

export async function planBuildRouting(
  options: BuildContext & {
    readonly state: EnvironmentState;
    readonly build: BuildDefinition;
  },
): Promise<{
  readonly state: EnvironmentState;
  readonly updates: readonly FileUpdate[];
}> {
  if (options.build.scope !== "shared") {
    const routing = renderSkillRouting({
      state: options.state,
      scopes: [
        {
          key: "global",
          directory: path.dirname(options.paths.shadowcloneDirectory),
          repository: null,
        },
      ],
    });

    const planned = await planBuildIntegrations({ ...options, routing });

    return { state: options.state, updates: planned.updates };
  }

  const updates: FileUpdate[] = [];
  let state = options.state;

  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    const filePath = path.join(options.build.directory, name);
    const previous = await readLocalText(filePath);
    const artifact = state.artifacts.find(
      (entry) => entry.filePath === filePath,
    );

    const body =
      name === "CLAUDE.md"
        ? "@AGENTS.md"
        : renderBuildRouting({
            state,
            cwd: options.build.directory,
            sharedOnly: true,
          });

    const changed = updateManagedSection({
      previous,
      expected: artifact?.fingerprint,
      body,
    });

    updates.push({ filePath, previous, next: changed.text });
    state = {
      ...state,
      artifacts: [
        ...state.artifacts.filter((entry) => entry.filePath !== filePath),
        {
          filePath,
          original: artifact ? artifact.original : previous,
          fingerprint: changed.fingerprint,
          kind: "instructions",
          scope: options.build.id,
          name,
          description: "Shared build routing",
          learningKeys: [],
          buildId: options.build.id,
        },
      ],
    };
  }

  return { state, updates };
}
