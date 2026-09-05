import {
  detectEngine,
  type CommandProbe,
  type EngineId,
} from "../engine";
import {
  readManagedPolicy,
  type DistillationPolicy,
} from "../config";
import { projectPaths } from "../paths";
import {
  getProviderSupport,
  providerDefinitions,
} from "../provider";

export function renderProviderSupport(): readonly string[] {
  return providerDefinitions.map((definition) => {
    const support = getProviderSupport(definition);
    return `${definition.id}: observe=${support.observe ? "yes" : "no"}, distill=${
      support.distill ? "yes" : "no"
    }, dispatch=${support.dispatch ? "yes" : "no"}`;
  });
}

export function renderEngineSelection(options: {
  readonly distillation: DistillationPolicy;
  readonly selectedEngine: EngineId | null;
}): string {
  if (options.distillation === "disabled") {
    return "Deep distillation is disabled by managed policy.";
  }
  if (options.distillation === "local-only") {
    return "Deep distillation is restricted to local engines, which are not implemented.";
  }
  return options.selectedEngine
    ? `Selected engine: ${options.selectedEngine}`
    : "No authenticated distillation engine is available.";
}

export async function doctor(options: {
  readonly probe?: CommandProbe;
  readonly managedConfigPath?: string | null;
} = {}): Promise<void> {
  const managedConfigPath =
    options.managedConfigPath === undefined
      ? projectPaths.managedConfigFile
      : options.managedConfigPath;
  const policy = await readManagedPolicy(managedConfigPath);
  if (
    managedConfigPath !== null &&
    (await Bun.file(managedConfigPath).exists())
  ) {
    console.log(`Managed policy: ${managedConfigPath}`);
  }
  if (!policy.enabled) {
    console.log("Managed policy: shadowclone is disabled.");
    return;
  }
  const allowedEngines =
    policy.distillation === "allowed" ? policy.allowedEngines : [];
  const detection = await detectEngine({
    purpose: "distill",
    probe: options.probe,
    allowedEngines,
  });
  for (const engine of detection.availability) {
    const status = engine.authenticated
      ? "authenticated"
      : engine.installed
        ? "installed, authentication not found"
        : "not installed";
    console.log(`${engine.engine}: ${status}`);
  }
  console.log(
    renderEngineSelection({
      distillation: policy.distillation,
      selectedEngine: detection.selectedEngine,
    }),
  );
  console.log("Provider support:");
  for (const line of renderProviderSupport()) {
    console.log(line);
  }
}
