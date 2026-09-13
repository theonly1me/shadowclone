import type { EngineId, EngineRun, EngineRunner, ReasoningEffort } from "../../engine";
import { redactSecrets } from "../../redact";
import {
  evaluationSignal,
  throwIfEvaluationExpired,
} from "./deadline";
import type { ModelCall } from "./types";

export function modelCaller(options: {
  readonly runner: EngineRunner;
  readonly engine: EngineId;
  readonly model: string;
  readonly reasoningEffort?: ReasoningEffort;
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
    throwIfEvaluationExpired();
    if (totalCalls >= callLimit) {
      throw new Error("Evaluation invocation limit reached");
    }
    totalCalls += 1;

    const blockedPaths = [
      ...(options.blockedPaths ?? []),
      ...(request.access === "write" && options.controlDirectory
        ? [options.controlDirectory]
        : []),
      ...(request.blockedPaths ?? []),
    ];

    const access = request.access;
    const execution = access === "read" || access === "write"
      ? { purpose: "evaluation" as const, access, blockedPaths }
      : { purpose: "evaluation" as const, blockedPaths };
    const signal = evaluationSignal();
    let run: EngineRun;
    try {
      run = await options.runner({
      prompt: request.prompt,
      cwd: request.cwd,
      model: options.model,
      reasoningEffort: options.reasoningEffort,
      execution,
      outputSchema: request.outputSchema,
      permissionMode: "dontAsk",
      ...(request.access === "write"
        ? {}
        : request.access === "read" && options.engine === "claude-code"
          ? { allowedTools: ["Read", "Glob", "Grep"] }
          : request.access === "none"
            ? { allowedTools: [] }
            : {}),
      ...(options.maxBudgetUsd === undefined
        ? {}
        : { maxBudgetUsd: options.maxBudgetUsd }),
        signal: signal
          ? AbortSignal.any([
              signal,
              AbortSignal.timeout(options.timeoutSeconds * 1000),
            ])
          : AbortSignal.timeout(options.timeoutSeconds * 1000),
      });
    } catch (error) {
      throwIfEvaluationExpired();
      throw error;
    }
    throwIfEvaluationExpired();

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
