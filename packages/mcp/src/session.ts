import type { z } from "zod";
import type { ProjectPaths } from "@shadowclone/core";
import {
  checkCloudHost,
  checkSessionHost,
  clonesPaths,
  githubThroughGh,
  hostProcesses,
  pushSessionSkills,
  readSessionConfig,
  setUpSessions,
  startSession,
} from "@shadowclone/clones";
import { isRecord } from "./protocol";
import { setupText } from "./sessionText";
import { sessionInputSchema } from "./sessionTools";

type Input = z.infer<typeof sessionInputSchema>;

function text(options: { readonly value: string; readonly isError?: boolean }) {
  return { content: [{ type: "text", text: options.value }], isError: options.isError ?? false };
}

async function runOperation(options: {
  readonly input: Input;
  readonly cwd: string;
  readonly paths: ProjectPaths;
}): Promise<string> {
  const { input } = options;

  if (input.operation === "skills") {
    const outcome = await pushSessionSkills({
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

  if (input.operation === "start") {
    if (input.issue === undefined) {
      throw new Error("Name the issue or pull request number.");
    }

    return startSession({
      github: githubThroughGh,
      repository: input.repository,
      entity: input.issue,
      task: input.task,
    });
  }

  if (input.operation === "status") {
    const config = await readSessionConfig({ paths: clonesPaths(), repository: input.repository });

    if (config === null) {
      throw new Error(
        `No cloud session setup is saved for ${input.repository} on this machine. Call setup first.`,
      );
    }

    const lines =
      config.host === "local"
        ? await checkSessionHost({ config, paths: clonesPaths(), processes: hostProcesses })
        : await checkCloudHost({ config, github: githubThroughGh });

    return lines
      .map((line) => `${line.passed ? "pass" : "fail"} ${line.name}: ${line.detail}`)
      .join("\n");
  }

  const executable = Bun.which("shadowclone") ?? "shadowclone";

  return setupText(
    await setUpSessions({
      github: githubThroughGh,
      processes: hostProcesses,
      paths: clonesPaths(),
      repository: input.repository,
      provider: input.provider,
      host: input.host,
      ...(input.receiver === undefined ? {} : { receiver: input.receiver }),
      ...(input.supabaseProject === undefined ? {} : { supabaseProject: input.supabaseProject }),
      ...(input.denoOrganization === undefined ? {} : { denoOrganization: input.denoOrganization }),
      ...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
      ...(input.model === undefined ? {} : { model: input.model }),
      attribution: input.attribution,
      approveRuleset: input.approve,
      executable,
      pathVariable: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      environment: process.env,
    }),
  );
}

export function createSessionTool(context: { readonly cwd: string; readonly paths: ProjectPaths }) {
  return {
    run: async (params: unknown) => {
      if (!isRecord(params) || params.name !== "shadowclone_session") {
        return null;
      }

      const input = sessionInputSchema.safeParse(params.arguments);

      if (!input.success) {
        return text({
          value:
            "Use operation skills, setup, status, or start. Tokens go in the secrets file, never here.",
          isError: true,
        });
      }

      try {
        return text({ value: await runOperation({ input: input.data, ...context }) });
      } catch (error) {
        return text({
          value:
            error instanceof Error ? error.message : "The session operation could not complete.",
          isError: true,
        });
      }
    },
  };
}
