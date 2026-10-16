import path from "node:path";
import { z } from "zod";
import { canonicalPath, projectPaths, readEffectiveConfig } from "@shadowclone/core";
import { compileContext } from "./compile";
import { markIntegrationDelivered, readIntegrations } from "./state";
import type { Integration, IntegrationOptions } from "./types";
import { bindNativeSessionOrigin, nativeBindingTimestamp } from "./bindings";
import { takeLearningNotice } from "../environment/learningNotice";
import { takeReviewPrompt } from "../environment/reviewPrompt";
import { learningSessionKey } from "./sessionKey";

const inputSchema = z
  .object({
    cwd: z.string().optional(),
    workspace_roots: z.array(z.string()).optional(),
    workspacePaths: z.array(z.string()).optional(),
    session_id: z.string().optional(),
    sessionId: z.string().optional(),
    conversationId: z.string().optional(),
    conversation_id: z.string().optional(),
    hook_event_name: z.string().optional(),
  })
  .passthrough();
type NativeInput = z.infer<typeof inputSchema>;

const instructionRoutedAgents: readonly Integration["agent"][] = ["claude-code", "codex", "pi", "opencode"];

function parseInput(input: string): NativeInput {
  try {
    return inputSchema.parse(JSON.parse(input || "{}"));
  } catch {
    throw new Error("Invalid native hook input");
  }
}

function nativeSessionId(input: NativeInput): string | null {
  return (
    input.session_id ??
    input.sessionId ??
    input.conversationId ??
    input.conversation_id ??
    null
  );
}

function activeIntegration(options: {
  readonly integration: Integration;
  readonly integrations: readonly Integration[];
  readonly cwd: string;
}): boolean {
  const local = options.integrations
    .filter(
      (entry) =>
        entry.agent === options.integration.agent &&
        entry.scope === "repository" &&
        (options.cwd === entry.directory ||
          options.cwd.startsWith(`${entry.directory}${path.sep}`)),
    )
    .sort((left, right) => right.directory.length - left.directory.length)[0];

  return options.integration.scope === "repository"
    ? local?.id === options.integration.id
    : local === undefined;
}

export async function nativeSessionStart(
  options: IntegrationOptions & {
    readonly id: string;
    readonly input: string;
  },
): Promise<Readonly<Record<string, unknown>>> {
  const paths = options.paths ?? projectPaths;
  const integrations = await readIntegrations(paths);
  const integration = integrations.find((entry) => entry.id === options.id);

  if (!integration) {
    return {};
  }

  const input = parseInput(options.input);
  const cwd = canonicalPath(
    input.cwd ??
      input.workspace_roots?.[0] ??
      input.workspacePaths?.[0] ??
      process.cwd(),
  );

  if (!activeIntegration({ integration, integrations, cwd })) {
    return {};
  }

  const scopedDelivery = instructionRoutedAgents.includes(integration.agent);
  const profile = await compileContext({
    ...options,
    paths,
    cwd,
    ...(scopedDelivery ? { scope: integration.scope === "global" ? "scoped" as const : "global" as const } : {}),
  });

  if (profile === null) {
    return {};
  }

  const sessionId = nativeSessionId(input);

  if (sessionId !== null) {
    await bindNativeSessionOrigin({
      ...options,
      paths,
      integration,
      sessionId,
      cwd,
      timestamp: nativeBindingTimestamp(input.timestamp),
    });
  }

  if (scopedDelivery && integration.scope === "repository") {
    return {};
  }

  const mainSession = input.hook_event_name !== "SubagentStart";
  const notice = mainSession ? await takeLearningNotice(paths) : "";
  const review = mainSession ? await takeReviewPrompt(paths) : "";
  const additionalContext = [profile, notice, review].filter((part) => part.length > 0).join("\n\n");

  if (additionalContext.length === 0) {
    return {};
  }

  await markIntegrationDelivered({ paths, id: integration.id, deliveredAt: Date.now() });

  if (integration.agent === "pi" || integration.agent === "opencode") return { additionalContext };

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

  integration.agent satisfies "claude-code" | "codex";

  return {
    hookSpecificOutput: {
      hookEventName:
        integration.agent === "claude-code"
          ? (input.hook_event_name ?? "SessionStart")
          : "SessionStart",
      additionalContext,
    },
  };
}

export async function nativeSessionEnd(
  options: IntegrationOptions & {
    readonly id: string;
    readonly input: string;
  },
): Promise<string | null> {
  const paths = options.paths ?? projectPaths;
  const integration = (await readIntegrations(paths)).find(
    (entry) => entry.id === options.id,
  );

  if (!integration) {
    return null;
  }

  const input = parseInput(options.input);
  if (integration.agent === "pi" || integration.agent === "opencode") {
    const integrations = await readIntegrations(paths);
    if (!activeIntegration({ integration, integrations, cwd: canonicalPath(input.cwd ?? process.cwd()) })) return null;
    const { config } = await readEffectiveConfig({ configPath: options.configPath ?? paths.configFile,
      managedConfigPath: options.managedConfigPath === undefined ? paths.managedConfigFile : options.managedConfigPath });
    if (!config.sources[integration.agent]) return null;
  }
  const nativeId = nativeSessionId(input);

  if (!nativeId) {
    return null;
  }

  return learningSessionKey({
    agent: integration.agent,
    nativeSessionId: nativeId,
  });
}
