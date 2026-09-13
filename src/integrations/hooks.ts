import path from "node:path";
import { z } from "zod";
import { readEffectiveConfig } from "../config";
import {
  createLearningRequest,
  endLearningRequest,
  learningSessionKey,
} from "../learning";
import { canonicalPath, projectPaths } from "../paths";
import { compileContext } from "./compile";
import { readIntegrations, saveIntegration } from "./state";
import type { Integration, IntegrationOptions } from "./types";

const inputSchema = z.object({
  cwd: z.string().optional(),
  workspace_roots: z.array(z.string()).optional(),
  workspacePaths: z.array(z.string()).optional(),
  session_id: z.string().optional(),
  sessionId: z.string().optional(),
  conversationId: z.string().optional(),
  conversation_id: z.string().optional(),
  hook_event_name: z.string().optional(),
}).passthrough();
type NativeInput = z.infer<typeof inputSchema>;

function parseInput(input: string): NativeInput {
  try {
    return inputSchema.parse(JSON.parse(input || "{}"));
  } catch {
    throw new Error("Invalid native hook input");
  }
}

function nativeSessionId(input: NativeInput): string | null {
  return input.session_id ?? input.sessionId ?? input.conversationId ??
    input.conversation_id ?? null;
}

function activeIntegration(options: {
  readonly integration: Integration;
  readonly integrations: readonly Integration[];
  readonly cwd: string;
}): boolean {
  const local = options.integrations
    .filter((entry) =>
      entry.agent === options.integration.agent &&
      entry.scope === "repository" &&
      (options.cwd === entry.directory ||
        options.cwd.startsWith(`${entry.directory}${path.sep}`))
    )
    .sort((left, right) => right.directory.length - left.directory.length)[0];
  return options.integration.scope === "repository"
    ? local?.id === options.integration.id
    : local === undefined;
}

async function learningInstruction(options: {
  readonly integration: Integration;
  readonly input: NativeInput;
  readonly integrationOptions: IntegrationOptions;
}): Promise<string> {
  const nativeId = nativeSessionId(options.input);
  if (!nativeId) {
    return "";
  }
  const paths = options.integrationOptions.paths ?? projectPaths;
  const { config, policy } = await readEffectiveConfig({
    configPath: options.integrationOptions.configPath ?? paths.configFile,
    managedConfigPath: options.integrationOptions.managedConfigPath === undefined
      ? paths.managedConfigFile
      : options.integrationOptions.managedConfigPath,
  });
  if (
    !config.distillation.deep ||
    !config.distillation.automatic ||
    policy.distillation !== "allowed"
  ) {
    return "";
  }
  const sessionKey = learningSessionKey({
    agent: options.integration.agent,
    nativeSessionId: nativeId,
  });
  const token = await createLearningRequest({
    paths,
    integrationId: options.integration.id,
    sessionKey,
  });
  return [
    "If this becomes a substantive session containing an explicit reusable engineering preference or a clear correction, run `shadowclone learn --session " + token + "` once near the end.",
    "Do not request learning because of a stopped tool call, added context, cancellation, question, temporary exception, or silence alone.",
  ].join("\n");
}

export async function nativeSessionStart(options: IntegrationOptions & {
  readonly id: string;
  readonly input: string;
}): Promise<Readonly<Record<string, unknown>>> {
  const paths = options.paths ?? projectPaths;
  const integrations = await readIntegrations(paths);
  const integration = integrations.find((entry) => entry.id === options.id);
  if (!integration) {
    return {};
  }
  const input = parseInput(options.input);
  const cwd = canonicalPath(
    input.cwd ?? input.workspace_roots?.[0] ?? input.workspacePaths?.[0] ??
      process.cwd(),
  );
  if (!activeIntegration({ integration, integrations, cwd })) {
    return {};
  }
  const profile = await compileContext({ ...options, paths, cwd });
  if (profile === null) {
    return {};
  }
  const learning = input.hook_event_name === "SubagentStart"
    ? ""
    : await learningInstruction({
        integration,
        input,
        integrationOptions: options,
      });
  const additionalContext = [profile, learning].filter(Boolean).join("\n\n");
  await saveIntegration({
    paths,
    integration: { ...integration, deliveredAt: Date.now() },
  });
  if (integration.agent === "cursor") {
    return { additional_context: additionalContext };
  }
  if (integration.agent === "antigravity") {
    return {
      decision: "allow",
      hookSpecificOutput: {
        hookEventName: "PreInvocation",
        ephemeralMessage: additionalContext,
      },
    };
  }
  return {
    hookSpecificOutput: {
      hookEventName: integration.agent === "claude-code"
        ? input.hook_event_name ?? "SessionStart"
        : "SessionStart",
      additionalContext,
    },
  };
}

export async function nativeSessionEnd(options: IntegrationOptions & {
  readonly id: string;
  readonly input: string;
}): Promise<string | null> {
  const paths = options.paths ?? projectPaths;
  const integration = (await readIntegrations(paths)).find(
    (entry) => entry.id === options.id,
  );
  if (!integration) {
    return null;
  }
  const nativeId = nativeSessionId(parseInput(options.input));
  if (!nativeId) {
    return null;
  }
  const sessionKey = learningSessionKey({
    agent: integration.agent,
    nativeSessionId: nativeId,
  });
  await endLearningRequest({
    paths,
    integrationId: integration.id,
    sessionKey,
  });
  return sessionKey;
}
