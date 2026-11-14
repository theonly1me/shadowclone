import { liveAskText, liveOffReason, type LiveSessions } from "@shadowclone/live";
import { toolText } from "../cloneSetup";
import { isRecord } from "../protocol";
import { askInputSchema, askToolName } from "./tool";

export function isAskCall(params: unknown): boolean {
  return isRecord(params) && params.name === askToolName;
}

export function createAskTool(context: {
  readonly live?: LiveSessions;
  readonly environment: Readonly<Record<string, string | undefined>>;
}) {
  return {
    run: async (params: unknown) => {
      if (!isRecord(params) || !isAskCall(params)) {
        return null;
      }

      const input = askInputSchema.safeParse(params.arguments);

      if (!input.success) {
        return toolText({
          value:
            "Give session (your live-xxxxxxxx id), question, 2 to 4 options, and recommended, which must be one of the options.",
          isError: true,
        });
      }

      if (context.live === undefined) {
        return toolText({ value: liveOffReason, isError: true });
      }

      const { session, question, options, recommended } = input.data;

      return context.live
        .ask({
          id: session,
          environment: context.environment,
          input: { text: question, options, recommended },
        })
        .then((outcome) =>
          toolText({ value: liveAskText(outcome), isError: outcome.kind === "refused" }),
        )
        .catch((error: unknown) =>
          toolText({
            value: error instanceof Error ? error.message : "The question could not be asked.",
            isError: true,
          }),
        );
    },
  };
}
