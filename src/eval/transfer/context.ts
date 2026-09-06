import { existsSync } from "node:fs";
import { lstat, mkdir } from "node:fs/promises";
import path from "node:path";
import type { EngineId } from "../../engine";
import { redactSecrets } from "../../redact";

export type ContextFile = {
  readonly relativePath: string;
  readonly content: string;
};

export async function captureContext(options: {
  readonly enabled: boolean;
  readonly home: string;
  readonly repository: string;
  readonly engine: EngineId;
}): Promise<readonly ContextFile[]> {
  if (!options.enabled) {
    return [];
  }

  const roots =
    options.engine === "codex"
      ? [".codex/skills", ".agents/skills"]
      : [".claude/skills", ".agents/skills"];
  const files: ContextFile[] = [];
  let totalBytes = 0;

  async function addFile(fileOptions: {
    readonly absolute: string;
    readonly relative: string;
  }): Promise<void> {
    const file = Bun.file(fileOptions.absolute);
    if (!(await file.exists())) {
      return;
    }

    const stat = await lstat(fileOptions.absolute);
    if (!stat.isFile()) {
      throw new Error(
        "Agent context contains a symbolic link or unsupported file",
      );
    }

    totalBytes += file.size;
    if (totalBytes > 2_000_000) {
      throw new Error("Agent context exceeds the evaluation snapshot limit");
    }

    const content = redactSecrets({ text: await file.text() });
    if (
      content.includes("shadowclone hook") ||
      content.includes("# Shadowclone profile")
    ) {
      throw new Error(
        "Existing agent instructions contain Shadowclone injection; baseline cannot be isolated",
      );
    }

    files.push({ relativePath: fileOptions.relative, content });
  }

  for (const [rootIndex, root] of roots.entries()) {
    const directory = path.join(options.home, root);
    if (!existsSync(directory)) {
      continue;
    }

    const glob = new Bun.Glob("**/*.md");
    for await (const relative of glob.scan({
      cwd: directory,
      onlyFiles: true,
      dot: false,
    })) {
      if (relative.split(path.sep).includes("shadowclone")) {
        continue;
      }
      await addFile({
        absolute: path.join(directory, relative),
        relative: `skills/${rootIndex}/${relative}`,
      });
    }
  }

  const instructions =
    options.engine === "codex"
      ? [".codex/AGENTS.md", ".codex/AGENTS.override.md"]
      : [".claude/CLAUDE.md"];

  for (const [instructionIndex, relative] of instructions.entries()) {
    await addFile({
      absolute: path.join(options.home, relative),
      relative: `instructions/${instructionIndex}.md`,
    });
  }

  const memory =
    options.engine === "codex"
      ? path.join(options.home, ".codex/memories")
      : path.join(
          options.home,
          ".claude/projects",
          options.repository.replaceAll(/[^a-zA-Z0-9]/g, "-"),
          "memory",
        );

  if (!existsSync(memory)) {
    return files.sort((left, right) =>
      left.relativePath.localeCompare(right.relativePath),
    );
  }

  const memoryGlob = new Bun.Glob("**/*.md");
  for await (const relative of memoryGlob.scan({
    cwd: memory,
    onlyFiles: true,
  })) {
    await addFile({
      absolute: path.join(memory, relative),
      relative: `memory/${relative}`,
    });
  }

  return files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
}

export async function installContext(options: {
  readonly files: readonly ContextFile[];
  readonly directory: string;
}): Promise<string> {
  if (options.files.length === 0) {
    return "";
  }

  const root = path.join(options.directory, ".eval-context");

  for (const file of options.files) {
    const targetPath = path.resolve(root, file.relativePath);
    if (!targetPath.startsWith(`${root}${path.sep}`)) {
      throw new Error("Invalid context path");
    }

    await mkdir(path.dirname(targetPath), { recursive: true });
    await Bun.write(targetPath, file.content);
  }

  return [
    "Your existing instructions, skills and memory were frozen for this task.",
    "Read the repository AGENTS.md and CLAUDE.md instructions when present. Read .eval-context/instructions and .eval-context/memory before working; select relevant skills under .eval-context/skills.",
    "These files describe the normal setup and are identical for every run.",
  ].join("\n");
}
