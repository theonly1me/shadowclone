import type { z } from "zod";
import {
  liveOffReason,
  livePairLines,
  livePairText,
  livePeerText,
  liveUnpairText,
  type LiveSessions,
} from "@shadowclone/live";
import { toolText } from "./cloneSetup";
import { pairInputSchema, peerInputSchema } from "./pairTools";
import { isRecord } from "./protocol";

type ToolText = ReturnType<typeof toolText>;

function failure(error: unknown): ToolText {
  return toolText({
    value: error instanceof Error ? error.message : "The pair operation could not complete.",
    isError: true,
  });
}

async function runPairing(options: {
  readonly live: LiveSessions;
  readonly input: z.infer<typeof pairInputSchema>;
}): Promise<ToolText> {
  const { live, input } = options;

  switch (input.operation) {
    case "pair": {
      const [first, second] = input.sessions;
      const outcome = await live.pair({ first, second });

      return toolText({ value: livePairText(outcome), isError: outcome.kind === "refused" });
    }
    case "unpair": {
      const outcome = await live.unpair(input.pair);

      return toolText({ value: liveUnpairText(outcome), isError: outcome.kind === "refused" });
    }
    case "list": {
      const pairs = await live.pairs();

      return toolText({ value: pairs.length === 0 ? "No open pairs." : livePairLines(pairs).join("\n") });
    }
  }
}

export function createPairTool(context: { readonly live?: LiveSessions }) {
  return {
    run: async (params: unknown): Promise<ToolText | null> => {
      if (!isRecord(params) || params.name !== "shadowclone_pair") {
        return null;
      }

      const input = pairInputSchema.safeParse(params.arguments);

      if (!input.success) {
        return toolText({
          value: "Use operation pair with two live session ids, unpair with a pair id, or list.",
          isError: true,
        });
      }

      return context.live === undefined
        ? toolText({ value: liveOffReason, isError: true })
        : runPairing({ live: context.live, input: input.data }).catch(failure);
    },
  };
}

export function createPeerTool(context: { readonly live?: LiveSessions }) {
  return {
    run: async (params: unknown): Promise<ToolText | null> => {
      if (!isRecord(params) || params.name !== "shadowclone_peer") {
        return null;
      }

      const input = peerInputSchema.safeParse(params.arguments);

      if (!input.success) {
        return toolText({
          value: "Use operation send with the key from your pairing note and the text of the note.",
          isError: true,
        });
      }

      if (context.live === undefined) {
        return toolText({ value: liveOffReason, isError: true });
      }

      return context.live
        .peerSend({ key: input.data.key, text: input.data.text })
        .then((outcome) =>
          toolText({ value: livePeerText(outcome), isError: outcome.kind === "refused" }),
        )
        .catch(failure);
    },
  };
}
