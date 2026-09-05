import {
  detectEngine,
  type CommandProbe,
} from "../engine";
import { readManagedPolicy } from "../config";
import { projectPaths } from "../paths";

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
    detection.selectedEngine
      ? `Selected engine: ${detection.selectedEngine}`
      : "No authenticated engine is available.",
  );
}
