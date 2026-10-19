import { z } from "zod";
import type { GitFacts } from "./git";
import { boundedText, liveOwnerMessage, summaryLimit } from "./messages";
import type { LivePaths } from "./paths";
import { surfaceFrom, type LiveEngine, type LiveRecord } from "./record";
import { takeInbox } from "./store";
import type { TypeText } from "./terminal";

export const hookInputSchema = z.object({
  session_id: z.string().min(1),
  hook_event_name: z.string(),
  cwd: z.string().optional(),
  last_assistant_message: z.string().nullable().optional(),
  notification_type: z.string().optional(),
  message: z.string().optional(),
});

export type HookInput = z.infer<typeof hookInputSchema>;

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
  readonly typeText: TypeText;
};

export type Change = {
  readonly record: Partial<LiveRecord>;
  readonly output: Readonly<Record<string, unknown>> | null;
  readonly typeWaiting?: boolean;
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

export async function changeFor(options: {
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
          ? { record: { state: "idle" }, output: null, typeWaiting: true }
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
    case "StopFailure":
      return { record: { state: "idle", attention: null }, output: null, typeWaiting: true };
    case "SessionEnd":
      return { record: { state: "ended", attention: null }, output: null };
    default:
      return null;
  }
}
