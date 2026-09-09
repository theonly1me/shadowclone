import {
  getProviderByEngine,
  providerSupportsPurpose,
} from "../provider";
import { validateEngineExecution } from "./execution";
import type {
  EngineId,
  EngineRun,
  EngineRunner,
} from "./types";

export type LearningExecutionLimits = {
  readonly maximumCalls: number;
  readonly timeoutMilliseconds: number;
  readonly maximumCostUsd: number;
};

export const defaultLearningExecutionLimits: LearningExecutionLimits = {
  maximumCalls: 20,
  timeoutMilliseconds: 300_000,
  maximumCostUsd: 2,
};

export type LearningExecution = {
  readonly runner: EngineRunner;
  readonly callsUsed: () => number;
};

function validateLimits(limits: LearningExecutionLimits): void {
  if (!Number.isSafeInteger(limits.maximumCalls) || limits.maximumCalls < 1) {
    throw new Error("Learning maximum calls must be a positive integer");
  }
  if (
    !Number.isFinite(limits.timeoutMilliseconds) ||
    limits.timeoutMilliseconds <= 0
  ) {
    throw new Error("Learning timeout must be a positive number");
  }
  if (
    !Number.isFinite(limits.maximumCostUsd) ||
    limits.maximumCostUsd <= 0
  ) {
    throw new Error("Learning cost limit must be a positive number");
  }
}

async function beforeDeadline(options: {
  readonly timeoutMilliseconds: number;
  readonly run: (signal: AbortSignal) => Promise<EngineRun>;
}): Promise<EngineRun> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Learning deadline reached"));
      controller.abort();
    }, options.timeoutMilliseconds);
  });

  try {
    return await Promise.race([options.run(controller.signal), timeout]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

export function createLearningExecution(options: {
  readonly engine: EngineId;
  readonly runner: EngineRunner;
  readonly limits?: LearningExecutionLimits;
}): LearningExecution {
  const limits = options.limits ?? defaultLearningExecutionLimits;
  validateLimits(limits);

  const provider = getProviderByEngine(options.engine);
  if (
    provider === null ||
    provider.engine === null ||
    !providerSupportsPurpose({ definition: provider, purpose: "distill" })
  ) {
    throw new Error("Engine cannot enforce the learning contract");
  }

  const supportsCostLimit = provider.engine.capabilities.maxBudgetUsd;
  const startedAt = Date.now();
  let callsUsed = 0;
  let costUsed = 0;

  const runner: EngineRunner = async (run) => {
    if (run.execution.purpose !== "learning") {
      throw new Error("Learning execution received a different purpose");
    }
    if (run.maxBudgetUsd !== undefined) {
      throw new Error("Learning execution owns the dollar limit");
    }
    validateEngineExecution(run);
    if (callsUsed >= limits.maximumCalls) {
      throw new Error("Learning call limit reached");
    }

    const remainingTime =
      limits.timeoutMilliseconds - (Date.now() - startedAt);
    if (remainingTime <= 0) {
      throw new Error("Learning deadline reached");
    }

    const remainingCost = limits.maximumCostUsd - costUsed;
    if (supportsCostLimit && remainingCost <= 0) {
      throw new Error("Learning cost limit reached");
    }

    callsUsed += 1;
    const result = await beforeDeadline({
      timeoutMilliseconds: remainingTime,
      run: (signal) =>
        options.runner({
          ...run,
          allowedTools: [],
          permissionMode: "dontAsk",
          signal,
          ...(supportsCostLimit ? { maxBudgetUsd: remainingCost } : {}),
        }),
    });

    if (result.engine !== options.engine) {
      throw new Error("Learning engine identity did not match its contract");
    }
    if (supportsCostLimit) {
      if (
        result.costUsd === null ||
        !Number.isFinite(result.costUsd) ||
        result.costUsd < 0
      ) {
        throw new Error("Learning engine did not report a valid cost");
      }
      costUsed += result.costUsd;
      if (costUsed > limits.maximumCostUsd) {
        throw new Error("Learning cost limit reached");
      }
    }

    return result;
  };

  return { runner, callsUsed: () => callsUsed };
}
