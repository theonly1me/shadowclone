import { z } from "zod";
import {
  type AccountSetupOutcome,
  checkText,
  cloneStatus,
  ghApiCall,
  type GhApiCall,
  type GhCommand,
  nextStepsText,
  openPage,
  providers,
  readInstallation,
  runCloneCheck,
  runGh,
  setUpAccountClone,
} from "@shadowclone/cloud";
import { isRecord } from "./protocol";
import type { BuildContext } from "@shadowclone/environment";

export const botTools = [
  {
    name: "shadowclone_bot",
    description:
      "Set up the shadowclone Actions bot for a GitHub repository, or check it. The bot is a " +
      "GitHub machine account that runs on a provider API key. Setup invites the bot, protects " +
      "the default branch, pushes the owner's skills to a private repository, and opens the " +
      "setup pull request. It returns one environment link where the owner adds the bot token " +
      "and the API key; keys never pass through this tool. The first setup call returns the " +
      "skill files: show them to the owner and call again with approveSkills true only after " +
      "the owner agrees. After the owner adds the keys and merges, call status: it runs a " +
      "check that accepts the invitation and confirms the key.",
    inputSchema: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["setup", "status"] },
        repository: { type: "string", description: "owner/repository" },
        bot: { type: "string", description: "GitHub login of the bot's machine account" },
        approveSkills: { type: "boolean", description: "true only after the owner approved the listed skill files" },
        provider: { type: "string", enum: [...providers], description: "API key provider; defaults to anthropic" },
        baseUrl: { type: "string", description: "https base URL, only for openai-compatible" },
        model: { type: "string", description: "model id; required for openai-compatible" },
      },
      required: ["operation"],
      additionalProperties: false,
    },
  },
];

const inputSchema = z.strictObject({
  operation: z.enum(["setup", "status"]),
  repository: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .optional(),
  bot: z
    .string()
    .regex(/^[A-Za-z0-9-]{1,39}$/)
    .optional(),
  approveSkills: z.boolean().optional(),
  provider: z.enum(providers).default("anthropic"),
  baseUrl: z.string().regex(/^https:\/\//).optional(),
  model: z.string().regex(/^[\w.:/-]+$/).optional(),
});

const statusWaitMilliseconds = 45_000;

function text(options: { readonly value: string; readonly isError?: boolean }) {
  return { content: [{ type: "text", text: options.value }], isError: options.isError ?? false };
}

async function outcomeText(outcome: AccountSetupOutcome): Promise<string> {
  if (outcome.kind === "needs-account") {
    await openPage(outcome.signupUrl);
    return `The GitHub account ${outcome.login} does not exist. The signup page is open. Ask the owner to create it, then call setup again.`;
  }

  if (outcome.kind === "needs-approval") {
    return [
      ...outcome.warnings,
      `Setup pushes these ${outcome.files.length} files to the private repository ${outcome.skillsRepository}:`,
      ...outcome.files.map((file) => `- ${file.path} (${file.bytes} bytes)`),
      "Show this list to the owner. Call setup again with approveSkills true only after the owner agrees.",
    ].join("\n");
  }

  await openPage(outcome.environmentUrl);

  return `${[
    ...outcome.warnings,
    nextStepsText({
      repository: outcome.clone.repository,
      environmentUrl: outcome.environmentUrl,
      pullUrl: outcome.pullUrl,
      checklist: outcome.checklist,
    }),
  ].join("\n\n")}\n\nThe environment page is open. Give the owner these links, and call status after they say done.`;
}

export function createBotTool(context: BuildContext & { readonly call?: GhApiCall; readonly command?: GhCommand }) {
  const call = context.call ?? ghApiCall;
  const command = context.command ?? runGh;
  return {
    run: async (params: unknown) => {
      if (!isRecord(params) || params.name !== "shadowclone_bot") {
        return null;
      }

      const input = inputSchema.safeParse(params.arguments);

      if (!input.success) {
        return text({
          value: "Use operation setup or status with repository, and bot for setup. Keys go on GitHub, never here.",
          isError: true,
        });
      }

      const { operation, repository, bot } = input.data;

      try {
        if (operation === "status") {
          if (repository === undefined) {
            return text({ value: JSON.stringify(await cloneStatus(context.paths)) });
          }

          const installation = await readInstallation({ paths: context.paths, repository });

          if (!installation) {
            return text({ value: `No Actions bot setup is saved for ${repository}. Call setup first.`, isError: true });
          }

          const check = await runCloneCheck({
            clone: installation.clone,
            call,
            pullUrl: installation.pullUrl,
            limitMilliseconds: statusWaitMilliseconds,
          });

          return text({ value: checkText(check), isError: check.kind === "failed" });
        }

        if (bot === undefined || repository === undefined) {
          return text({ value: "Name the bot's machine account with bot and the repository as owner/repository.", isError: true });
        }

        return text({
          value: await outcomeText(
            await setUpAccountClone({
              ...context,
              repository,
              botLogin: bot,
              approveSkills: input.data.approveSkills === true,
              provider: input.data.provider,
              ...(input.data.baseUrl === undefined ? {} : { baseUrl: input.data.baseUrl }),
              ...(input.data.model === undefined ? {} : { model: input.data.model }),
              call,
              command,
            }),
          ),
        });
      } catch (error) {
        return text({ value: error instanceof Error ? error.message : "Setup could not complete.", isError: true });
      }
    },
  };
}
