import { redactSecrets } from "@shadowclone/redact";
import type { Progress } from "../node/progress";
import type { SaveOutcome } from "./save";

export type FinalState = Exclude<Progress["state"], "working" | "waiting">;

export type EngineOutcome = {
  readonly outcome: "completed" | "failed" | "stopped";
  readonly tail: string;
  readonly summary: string;
};

const usageLimitPattern = /usage limit|rate limit reached|limit will reset|You've hit your limit/i;

const summaryLimit = 4000;

export function finalState(options: {
  readonly result: EngineOutcome;
  readonly aborted: boolean;
}): FinalState {
  const { result } = options;

  if (result.outcome !== "completed" && usageLimitPattern.test(result.tail)) {
    return "limited";
  }

  if (options.aborted || result.outcome === "stopped") {
    return "stopped";
  }

  return result.outcome === "completed" ? "done" : "failed";
}

export function finalDetail(options: {
  readonly state: FinalState;
  readonly saved: SaveOutcome;
}): string {
  const saved =
    options.saved === "saved"
      ? " The unfinished work is on the branch."
      : options.saved === "push-failed"
        ? " The unfinished work could not be pushed."
        : "";
  const details: Readonly<Record<FinalState, string>> = {
    done: "The clone finished.",
    limited: "The model login reached a usage limit. Start the clone again after the limit resets.",
    stopped: "The clone stopped before it finished, from a stop request or its time limit.",
    failed: "The agent did not finish the task. Read the report and the log.",
  };

  return `${details[options.state]}${saved}`;
}

export function boundedSummary(summary: string): string | undefined {
  const redacted = redactSecrets({ text: summary.trim() });

  if (redacted === "") {
    return undefined;
  }

  return redacted.length > summaryLimit ? `${redacted.slice(0, summaryLimit - 3)}...` : redacted;
}
