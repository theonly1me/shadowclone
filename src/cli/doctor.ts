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
  const detection = await detectEngine({ probe: options.probe });
  for (const engine of detection.availability) {
    const status = engine.authenticated
      ? "authenticated"
      : engine.installed
        ? "installed, authentication not found"
        : "not installed";
    console.log(`${engine.engine}: ${status}`);
  }
  const claudeAllowed =
    policy.allowedEngines.includes("claude-code") &&
    policy.distillation === "allowed";
  console.log(
    detection.runner && claudeAllowed
      ? "Selected engine: claude-code"
      : "No authenticated engine is available.",
  );
}
