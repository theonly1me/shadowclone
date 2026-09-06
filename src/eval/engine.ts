import {
  type CommandProbe,
  detectEngine,
  type EngineAvailability,
  type EngineId,
  type EngineRunner,
} from "../engine";

function reasonFor(options: {
  readonly requested: EngineId;
  readonly availability: readonly EngineAvailability[];
}): string {
  const found = options.availability.find(
    (candidate) => candidate.engine === options.requested,
  );
  if (!found?.installed) {
    return "it is not installed";
  }
  if (!found.authenticated) {
    return "it is not authenticated";
  }
  return "its evaluation runner is not implemented";
}

export async function selectEvalRunner(options: {
  readonly requested: EngineId | null;
  readonly allowedEngines: readonly EngineId[];
  readonly probe?: CommandProbe;
}): Promise<EngineRunner> {
  const requested = options.requested;
  if (requested && !options.allowedEngines.includes(requested)) {
    throw new Error(`Managed policy does not allow the ${requested} engine`);
  }
  const detection = await detectEngine({
    purpose: "eval",
    allowedEngines: requested ? [requested] : options.allowedEngines,
    probe: options.probe,
  });
  if (detection.runner) {
    return detection.runner;
  }
  if (requested) {
    throw new Error(
      `The ${requested} engine cannot run eval because ${reasonFor({
        requested,
        availability: detection.availability,
      })}`,
    );
  }
  throw new Error("No authenticated agent engine is available for eval");
}
