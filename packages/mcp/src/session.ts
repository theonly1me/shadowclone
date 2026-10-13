import { z } from "zod";
import type { ProjectPaths } from "@shadowclone/core";
import {
  checkSessionHost,
  clonesPaths,
  githubThroughGh,
  hostProcesses,
  pushSessionSkills,
  readSessionConfig,
  sessionProviders,
  setUpSessions,
  startSession,
} from "@shadowclone/clones";
import { isRecord } from "./protocol";
import { setupText } from "./sessionText";

export const sessionTools = [
  {
    name: "shadowclone_session",
    description:
      "Set up and use shadowclone cloud sessions on this machine. A session runs Claude Code or Codex " +
      "as the owner, on the owner's subscription or key, in Docker on this machine, and only the " +
      "owner's /shadowclone comment starts it. Operations: skills pushes the owner's skills to the " +
      "private skills repository (run it on the main machine; show the file list and call again with " +
      "approve true only after the owner agrees). setup checks Docker, adds the default branch " +
      "ruleset (show its summary and call again with approve true only after the owner agrees), " +
      "writes the config and the secrets file, and installs the service. Tokens never pass through " +
      "this tool: the owner pastes them into the secrets file. status runs the check in Docker. " +
      "start posts /shadowclone with a task on an issue or pull request.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["skills", "setup", "status", "start"] },
        repository: { type: "string", description: "owner/repository" },
        provider: {
          type: "string",
          enum: [...sessionProviders],
          description: "model login; defaults to claude-subscription",
        },
        baseUrl: {
          type: "string",
          description: "base URL for openai-compatible, ollama, or foundry",
        },
        model: {
          type: "string",
          description: "model id; required for openai-compatible, ollama, and foundry",
        },
        attribution: { type: "boolean", description: "false turns off the Co-authored-by trailer" },
        approve: {
          type: "boolean",
          description: "true only after the owner approved the listed files or the ruleset",
        },
        issue: { type: "number", description: "issue or pull request number for start" },
        task: { type: "string", description: "task text for start" },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  },
];

const inputSchema = z.strictObject({
  operation: z.enum(["skills", "setup", "status", "start"]),
  repository: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .optional(),
  provider: z.enum(sessionProviders).default("claude-subscription"),
  baseUrl: z
    .string()
    .regex(/^https?:\/\//)
    .optional(),
  model: z
    .string()
    .regex(/^[\w.:/-]+$/)
    .optional(),
  attribution: z.boolean().default(true),
  approve: z.boolean().default(false),
  issue: z.number().int().positive().optional(),
  task: z.string().max(4000).default(""),
});

type Input = z.infer<typeof inputSchema>;

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

    return (await checkSessionHost({ config, paths: clonesPaths(), processes: hostProcesses }))
      .map((line) => `${line.passed ? "pass" : "fail"} ${line.name}: ${line.detail}`)
      .join("\n");
  }

  const executable = Bun.which("shadowclone");

  if (executable === null) {
    throw new Error("Install the shadowclone CLI on this machine first.");
  }

  return setupText(
    await setUpSessions({
      github: githubThroughGh,
      processes: hostProcesses,
      paths: clonesPaths(),
      repository: input.repository,
      provider: input.provider,
      ...(input.baseUrl === undefined ? {} : { baseUrl: input.baseUrl }),
      ...(input.model === undefined ? {} : { model: input.model }),
      attribution: input.attribution,
      approveRuleset: input.approve,
      executable,
      pathVariable: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    }),
  );
}

export function createSessionTool(context: { readonly cwd: string; readonly paths: ProjectPaths }) {
  return {
    run: async (params: unknown) => {
      if (!isRecord(params) || params.name !== "shadowclone_session") {
        return null;
      }

      const input = inputSchema.safeParse(params.arguments);

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
