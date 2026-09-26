import path from "node:path";
import { z } from "zod";
import { learningSessionKey } from "../learning";
import { canonicalPath, projectPaths } from "../paths";
import { compileContext } from "./compile";
import { readIntegrations, saveIntegration } from "./state";
import type { Integration, IntegrationOptions } from "./types";
import { bindNativeSessionOrigin, nativeBindingTimestamp } from "./bindings";

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
  const profile = await compileContext({
    ...options,
    paths,
    cwd,
    audience: input.hook_event_name === "SubagentStart" ? "subagent" : "main",
    format: "index",
    nativeDuplicates: "including-harness",
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
  if (profile.length === 0) {
    return {};
  }
  const additionalContext = profile;
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
  return learningSessionKey({
    agent: integration.agent,
    nativeSessionId: nativeId,
  });
}
