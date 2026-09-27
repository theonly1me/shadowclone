import {
  createLearningExecution,
  detectEngine,
  type EngineId,
  type EngineRunner,
  type LearningExecution,
} from "../engine";

export async function resolveLearningExecution(options: {
  readonly runner?: EngineRunner;
  readonly engine?: EngineId;
  readonly execution?: LearningExecution;
  readonly allowedEngines: readonly EngineId[];
}): Promise<{
  readonly engine: EngineId;
  readonly runner: EngineRunner;
  readonly execution: LearningExecution;
}> {
  const detection = options.runner
    ? null
    : await detectEngine({
        purpose: "distill",
        allowedEngines: options.allowedEngines,
      });

  const runner = options.runner ?? detection?.runner;
  const engine = options.engine ?? detection?.selectedEngine;

  if (!runner || !engine) {
    throw new Error("No authenticated learning engine is available");
  }

  const execution =
    options.execution ?? createLearningExecution({ engine, runner });

  return { engine, runner, execution };
}
