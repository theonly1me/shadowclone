import { readEffectiveConfig } from "../config";
import { detectEngine } from "../engine";
import type { EngineId, EngineRunner } from "../engine/types";
import { getProviderByEngine } from "../provider";
import type { BuildContext } from "../builds/types";
import { selectLearningPreferences } from "../learning/modelPreferences";

export type GenerationEngine = {
  readonly engine: EngineId;
  readonly runner: EngineRunner;
  readonly model?: string;
};

export async function allowedGenerationEngines(context: BuildContext) {
  const { policy } = await readEffectiveConfig({
    configPath: context.paths.configFile,
    managedConfigPath: context.paths.managedConfigFile,
  });

  if (!policy.enabled || policy.distillation !== "allowed") {
    throw new Error("Managed policy does not allow model generation");
  }

  return policy.allowedEngines;
}

export async function generationEngine(
  options: BuildContext & { readonly engine?: GenerationEngine },
): Promise<GenerationEngine> {
  const allowed = await allowedGenerationEngines(options);
  const { config } = await readEffectiveConfig({ configPath: options.paths.configFile, managedConfigPath: options.paths.managedConfigFile });
  const preferences = selectLearningPreferences({ explicit: options.engine, saved: config.distillation });
  const detected = options.engine
    ? null
    : await detectEngine({
        purpose: "distill",
        allowedEngines: allowed,
        model: preferences.model,
        preferredEngine: preferences.engine,
      });

  const engine = options.engine?.engine ?? detected?.selectedEngine;
  const runner = options.engine?.runner ?? detected?.runner;

  if (!engine || !runner || !allowed.includes(engine)) {
    throw new Error("Sign in to a supported coding-agent CLI to use AI");
  }

  const model = preferences.model;
  return { engine, model, runner: model ? run => runner({ ...run, model }) : runner };
}

export function generationLimits(engine: EngineId): string {
  return getProviderByEngine(engine)?.engine?.capabilities.maxBudgetUsd
    ? "One call, 60 seconds, maximum $0.25. Your existing provider account is used."
    : "One call, 60 seconds. This provider has no enforceable dollar cap; charges use your existing account.";
}
