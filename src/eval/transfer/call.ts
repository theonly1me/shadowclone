import { redactSecrets } from "../../redact";
import type { EngineId, EngineRunner } from "../../engine";
import type { ModelCall } from "./types";

export function modelCaller(options: {
  readonly runner: EngineRunner;
  readonly engine: EngineId;
  readonly model: string;
  readonly timeoutSeconds: number;
  readonly maxBudgetUsd?: number;
  readonly blockedPaths?: readonly string[];
  readonly controlDirectory?: string;
  readonly maximumCalls?: number;
}): ModelCall {
  if (options.engine === "codex" && options.maxBudgetUsd !== undefined) {
    throw new Error(
      "Codex cannot enforce --max-budget-usd; use task counts and timeouts",
    );
  }

  let totalCalls = 0;
  const callLimit = options.maximumCalls ?? 200;

  return async (request) => {
    if (totalCalls >= callLimit) {
      throw new Error("Evaluation invocation limit reached");
    }
    totalCalls += 1;

    const blockedPaths = [
      ...(options.blockedPaths ?? []),
      ...(request.execute && options.controlDirectory
        ? [options.controlDirectory]
        : []),
    ];

    const run = await options.runner({
      prompt: request.prompt,
      cwd: request.cwd,
      model: options.model,
      evaluation: true,
      evaluationBlockedPaths: blockedPaths,
      outputSchema: request.outputSchema,
      permissionMode: "dontAsk",
      ...(request.execute ? {} : { allowedTools: [] }),
      ...(options.maxBudgetUsd === undefined
        ? {}
        : { maxBudgetUsd: options.maxBudgetUsd }),
      signal: AbortSignal.timeout(options.timeoutSeconds * 1000),
    });

    if (run.isError) {
      const message = run.errorMessage ?? "Evaluation engine failed";
      throw new Error(redactSecrets({ text: message }));
    }

    return {
      ...run,
      text: redactSecrets({ text: run.text }),
    };
  };
}
