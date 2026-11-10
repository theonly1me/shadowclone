import type { CloneNode } from "@shadowclone/clones";
import type { LiveSessions } from "@shadowclone/live";
import { toolText } from "../cloneSetup";
import { isRecord } from "../protocol";
import { cloneInputSchema, sessionsInputSchema } from "../sessionsTools";
import { controlClone } from "./control";
import { readSessions, type SessionsAnswer } from "./read";

function failure(error: unknown) {
  return toolText({
    value: error instanceof Error ? error.message : "The clone operation could not complete.",
    isError: true,
  });
}

function sessionsResult(answer: SessionsAnswer) {
  return {
    ...toolText({ value: answer.value }),
    ...(answer.board === undefined ? {} : { structuredContent: answer.board }),
  };
}

export function createSessionsTools(context: {
  readonly node: CloneNode;
  readonly live?: LiveSessions;
}) {
  return {
    run: async (params: unknown) => {
      if (!isRecord(params)) {
        return null;
      }

      if (params.name === "shadowclone_sessions") {
        const input = sessionsInputSchema.safeParse(params.arguments);

        return input.success
          ? readSessions({ ...context, input: input.data })
              .then(sessionsResult)
              .catch(failure)
          : toolText({ value: "Use operation list, or get with a clone id.", isError: true });
      }

      if (params.name === "shadowclone_clone") {
        const input = cloneInputSchema.safeParse(params.arguments);

        return input.success
          ? controlClone({ ...context, input: input.data })
              .then(toolText)
              .catch(failure)
          : toolText({
              value:
                "Use operation start with a repository and a task, send or answer with a clone id and text, or stop with a clone id.",
              isError: true,
            });
      }

      return null;
    },
  };
}
