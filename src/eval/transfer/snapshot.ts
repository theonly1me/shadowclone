import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { command } from "./command";
import { isolateNativeGuidance } from "./nativeIsolation";
import { validateSnapshotLinks } from "./snapshotLinks";
import { extractSnapshotArchive } from "./snapshotArchive";

export { validateSnapshotLinks } from "./snapshotLinks";

export interface SnapshotResult {
  readonly directory: string;
  readonly initialCommit: string;
  readonly cleanup: () => Promise<void>;
}

const templates = new Map<string, Promise<SnapshotResult>>();

function templateKey(options: {
  readonly repository: string;
  readonly commit: string;
}): string {
  return `${options.repository}\u0000${options.commit}`;
}

const restrictedSettingsPaths = [
  ".claude/settings.json",
  ".claude/settings.local.json",
  ".mcp.json",
  ".codex",
  ".claude/agents/shadowclone.md",
  ".claude/skills/shadowclone",
  ".claude/skills/shadowclone-context",
  ".agents/skills/shadowclone-context",
  ".cursor/hooks.json",
  ".cursor/rules/shadowclone.mdc",
  ".cursor/skills/shadowclone-context",
] as const;

async function buildSnapshotTemplate(options: {
  readonly repository: string;
  readonly commit: string;
}): Promise<SnapshotResult> {
  const container = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-transfer-"),
  );
  const directory = path.join(container, "workspace");
  try {
    await extractSnapshotArchive({ ...options, container, directory });

    await validateSnapshotLinks(directory);

    for (const relativePath of restrictedSettingsPaths) {
      await rm(path.join(directory, relativePath), {
        recursive: true,
        force: true,
      });
    }

    await isolateNativeGuidance(directory);
    await command({
      arguments: ["git", "init", "--quiet"],
      cwd: directory,
    });

    await command({
      arguments: ["git", "add", "--all"],
      cwd: directory,
    });

    await command({
      arguments: [
        "git",
        "-c",
        "user.name=Shadowclone",
        "-c",
        "user.email=eval@localhost",
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--quiet",
        "-m",
        "Evaluation starting state",
      ],
      cwd: directory,
    });

    const initialCommit = await command({
      arguments: ["git", "rev-parse", "HEAD"],
      cwd: directory,
    });

    return {
      directory,
      initialCommit,
      cleanup: async () => {
        await rm(container, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(container, { recursive: true, force: true });
    throw error;
  }
}

export async function createSnapshot(options: {
  readonly repository: string;
  readonly commit: string;
}): Promise<SnapshotResult> {
  const key = templateKey(options);
  let templatePromise = templates.get(key);
  if (!templatePromise) {
    templatePromise = buildSnapshotTemplate(options);
    templates.set(key, templatePromise);
  }

  let template: SnapshotResult;
  try {
    template = await templatePromise;
  } catch (error) {
    if (templates.get(key) === templatePromise) {
      templates.delete(key);
    }
    throw error;
  }

  const directory = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-transfer-"),
  );
  try {
    const source = `${template.directory}${path.sep}.`;
    const preferredArguments = process.platform === "darwin"
      ? ["cp", "-Rc", source, directory]
      : ["cp", "-R", "--reflink=auto", source, directory];
    try {
      await command({ arguments: preferredArguments, cwd: directory });
    } catch {
      await command({
        arguments: ["cp", "-R", source, directory],
        cwd: directory,
      });
    }
    return {
      directory,
      initialCommit: template.initialCommit,
      cleanup: async () => {
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function disposeSnapshotTemplates(): Promise<void> {
  const pendingTemplates = [...templates.values()];
  templates.clear();
  const results = await Promise.allSettled(pendingTemplates);
  await Promise.all(results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value.cleanup()] : []
  ));
}
