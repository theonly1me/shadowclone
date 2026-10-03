import { mkdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { runProcess } from "../../io/process";
import { requirePrivateDirectory } from "./files";
import { NativeInfrastructureError, type NativeDiagnostic } from "./diagnostics";

async function imageCommand(options: { arguments: string[]; directory: string; stage: NativeDiagnostic["stage"] }): Promise<void> {
  const result = await runProcess({ arguments: ["hdiutil", ...options.arguments], cwd: options.directory,
    environment: process.env, timeoutMilliseconds: 60_000, maximumOutputBytes: 4096 });
  if (result.exitCode !== 0) throw new NativeInfrastructureError({ stage: options.stage, confirmedInfrastructure: true,
    message: "Read-only workspace mount failed", details: `hdiutil exit ${result.exitCode}\n${result.stdout}\n${result.stderr}` });
}

export async function mountReadOnlyWorkspace(options: { sourceDirectory: string }) {
  if (process.platform !== "darwin") throw new Error("Read-only native workspaces require macOS");
  const sourceDirectory = await realpath(options.sourceDirectory);
  const container = await requirePrivateDirectory(path.dirname(sourceDirectory));
  if (!sourceDirectory.startsWith(`${container}${path.sep}`)) {
    throw new Error("Read-only workspace source escapes its private container");
  }
  const suffix = crypto.randomUUID();
  const image = path.join(container, `workspace-${suffix}.dmg`);
  const directory = path.join(container, `mounted-${suffix}`);
  await mkdir(directory, { mode: 0o700 });
  try {
    await imageCommand({ arguments: ["create", "-quiet", "-srcfolder", sourceDirectory,
      "-format", "UDRO", "-ov", "-o", image], directory: container, stage: "mount-create" });
    await imageCommand({ arguments: ["attach", "-quiet", "-readonly", "-nobrowse",
      "-mountpoint", directory, image], directory: container, stage: "mount-attach" });
  } catch (error) {
    await rm(image, { force: true });
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return {
    directory,
    cleanup: async () => {
      await imageCommand({ arguments: ["detach", "-quiet", directory], directory: container, stage: "mount-detach" });
      await rm(image, { force: true });
      await rm(directory, { recursive: true, force: true });
    },
  };
}
