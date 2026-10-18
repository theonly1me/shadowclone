import path from "node:path";
import { z } from "zod";
import type { GitFacts } from "./git";
import { boundedText, liveOwnerMessage, summaryLimit } from "./messages";
import type { LivePaths } from "./paths";
import { liveId, surfaceFrom, type LiveEngine, type LiveRecord } from "./record";
import { readRecord, takeInbox, writeRecord } from "./store";

const hookInputSchema = z.object({
  session_id: z.string().min(1),
  hook_event_name: z.string(),
  cwd: z.string().optional(),
  last_assistant_message: z.string().nullable().optional(),
  notification_type: z.string().optional(),
  message: z.string().optional(),
});

type HookInput = z.infer<typeof hookInputSchema>;

const attentionTypes = [
  "permission_prompt",
  "elicitation_dialog",
  "elicitation_url_dialog",
  "agent_needs_input",
];

export type HookContext = {
  readonly paths: LivePaths;
  readonly engine: LiveEngine;
  readonly now: Date;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly gitFacts: (cwd: string) => Promise<GitFacts>;
};

type Change = {
  readonly record: Partial<LiveRecord>;
  readonly output: Readonly<Record<string, unknown>> | null;
};

async function delivered(options: {
  readonly context: HookContext;
  readonly id: string;
  readonly wrap: (text: string) => Readonly<Record<string, unknown>>;
  readonly otherwise: Partial<LiveRecord>;
}): Promise<Change> {
  const messages = await takeInbox({ paths: options.context.paths, id: options.id });

  return messages.length === 0
    ? { record: options.otherwise, output: null }
    : { record: { state: "working" }, output: options.wrap(liveOwnerMessage(messages)) };
}

async function changeFor(options: {
  readonly context: HookContext;
  readonly input: HookInput;
  readonly id: string;
}): Promise<Change | null> {
  const { context, input, id } = options;
  const summary =
    typeof input.last_assistant_message === "string"
      ? { summary: boundedText({ text: input.last_assistant_message, limit: summaryLimit }) }
      : {};

  switch (input.hook_event_name) {
    case "SessionStart":
      return {
        record: { state: "idle", attention: null, surface: surfaceFrom(context.environment) },
        output: null,
      };
    case "UserPromptSubmit":
      return { record: { state: "working", attention: null }, output: null };
    case "PostToolUse":
      return delivered({
        context,
        id,
        wrap: (text) => ({
          hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text },
        }),
        otherwise: { state: "working" },
      });
    case "Notification":
      return attentionTypes.includes(input.notification_type ?? "")
        ? {
            record: {
              state: "needs-you",
              attention: boundedText({
                text: input.message ?? "The session needs you.",
                limit: 300,
              }),
            },
            output: null,
          }
        : input.notification_type === "idle_prompt"
          ? { record: { state: "idle" }, output: null }
          : null;
    case "PermissionRequest":
      return {
        record: { state: "needs-you", attention: "The session asks for a permission." },
        output: null,
      };
    case "Stop":
      return delivered({
        context,
        id,
        wrap: (text) => ({ decision: "block", reason: text }),
        otherwise: { state: "idle", attention: null, ...summary },
      }).then((change) => ({ ...change, record: { ...summary, ...change.record } }));
    case "SessionEnd":
      return { record: { state: "ended", attention: null }, output: null };
    default:
      return null;
  }
}

function parseInput(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function handleLiveHook(options: {
  readonly context: HookContext;
  readonly input: string;
}): Promise<Readonly<Record<string, unknown>> | null> {
  const { context } = options;
  const input = hookInputSchema.safeParse(parseInput(options.input));

  if (!input.success) {
    return null;
  }

  const id = liveId({ engine: context.engine, sessionId: input.data.session_id });
  const change = await changeFor({ context, input: input.data, id });

  if (change === null) {
    return null;
  }

  const existing = await readRecord({ paths: context.paths, id });
  const cwd = input.data.cwd ?? context.paths.home;
  const facts =
    existing === null || input.data.hook_event_name === "SessionStart"
      ? await context.gitFacts(cwd)
      : null;
  const now = context.now.toISOString();
  const base: LiveRecord = existing ?? {
    id,
    engine: context.engine,
    repository: path.basename(cwd),
    branch: null,
    folder: path.basename(cwd),
    state: "idle",
    startedAt: now,
    updatedAt: now,
    summary: "",
    attention: null,
    surface: surfaceFrom(context.environment),
  };

  await writeRecord({
    paths: context.paths,
    record: {
      ...base,
      ...(facts === null
        ? {}
        : { repository: facts.repository ?? path.basename(cwd), branch: facts.branch }),
      ...change.record,
      updatedAt: now,
    },
  });

  return change.output;
}

export async function runLiveHook(options: {
  readonly enabled: () => Promise<boolean>;
  readonly context: HookContext;
  readonly input: string;
}): Promise<Readonly<Record<string, unknown>> | null> {
  if (!(await options.enabled().catch(() => false))) {
    return null;
  }

  return handleLiveHook(options).catch(() => null);
}
