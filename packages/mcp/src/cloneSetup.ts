import type { z } from "zod";
import type { ProjectPaths } from "@shadowclone/core";
import {
  checkCloneHost,
  clonesPaths,
  githubThroughGh,
  hostProcesses,
  pushCloneSkills,
  readCloneConfig,
  setUpClones,
} from "@shadowclone/clones";
import { setupText } from "./cloneSetupText";
import { cloneSetupInputSchema } from "./cloneSetupTools";
import { isRecord } from "./protocol";

type Input = z.infer<typeof cloneSetupInputSchema>;

export function toolText(options: { readonly value: string; readonly isError?: boolean }) {
  return { content: [{ type: "text", text: options.value }], isError: options.isError ?? false };
}

async function runOperation(options: {
  readonly input: Input;
  readonly cwd: string;
  readonly paths: ProjectPaths;
}): Promise<string> {
  const { input } = options;

  if (input.operation === "skills") {
    const outcome = await pushCloneSkills({
      paths: options.paths,
      cwd: options.cwd,
      approve: input.approve,
    });

    return outcome.kind === "needs-approval"
      ? [
          `These ${outcome.files.length} files go to ${outcome.skillsRepository}:`,
          ...outcome.files.map((file) => `- ${file.path} (${file.bytes} bytes)`),
          "Call skills again with approve true only after the owner agrees.",
        ].join("\n")
      : `${outcome.kind === "pushed" ? "Pushed the skills to" : "No change in"} ${outcome.skillsRepository}.`;
  }

  if (input.repository === undefined) {
    throw new Error("Name the repository as owner/repository.");
  }

  if (input.operation === "status") {
    const config = await readCloneConfig({ paths: clonesPaths(), repository: input.repository });

    if (config === null) {
      throw new Error(
        `No clone setup is saved for ${input.repository} on this machine. Call setup first.`,
      );
    }

    const lines = await checkCloneHost({ config, paths: clonesPaths(), processes: hostProcesses });

    return lines
      .map((line) => `${line.passed ? "pass" : "fail"} ${line.name}: ${line.detail}`)
      .join("\n");
  }

  return setupText(
    await setUpClones({
      github: githubThroughGh,
      processes: hostProcesses,
      paths: clonesPaths(),
      repository: input.repository,
      provider: input.provider,
      ...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
      ...(input.model === undefined ? {} : { model: input.model }),
      attribution: input.attribution,
      approveRuleset: input.approve,
      executable: Bun.which("shadowclone") ?? "shadowclone",
      pathVariable: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    }),
  );
}

export function createCloneSetupTool(context: {
  readonly cwd: string;
  readonly paths: ProjectPaths;
}) {
  return {
    run: async (params: unknown) => {
      if (!isRecord(params) || params.name !== "shadowclone_clone_setup") {
        return null;
      }

      const input = cloneSetupInputSchema.safeParse(params.arguments);

      if (!input.success) {
        return toolText({
          value:
            "Use operation skills, setup, or status. Tokens go in the secrets file, never here.",
          isError: true,
        });
      }

      try {
        return toolText({ value: await runOperation({ input: input.data, ...context }) });
      } catch (error) {
        return toolText({
          value: error instanceof Error ? error.message : "The setup operation could not complete.",
          isError: true,
        });
      }
    },
  };
}
