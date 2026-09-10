import { mkdir, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import { resolveArtifactPath } from "./installTarget";
import type { InstalledArtifact } from "./installState";

export const artifactRelativePaths: Readonly<
  Record<InstalledArtifact, string>
> = {
  agent: path.join(".claude", "agents", "shadowclone.md"),
  "delegation-skill": path.join(
    ".claude",
    "skills",
    "shadowclone",
    "SKILL.md",
  ),
};

export const artifactExcludePatterns: Readonly<
  Record<InstalledArtifact, string>
> = {
  agent: ".claude/agents/shadowclone.md",
  "delegation-skill": ".claude/skills/shadowclone/",
};

const ownedLeafDirectory = path.join(".claude", "skills", "shadowclone");

async function gitExcludePath(cwd: string): Promise<string | null> {
  const child = Bun.spawn({
    cmd: ["git", "-C", cwd, "rev-parse", "--git-path", "info/exclude"],
    stdout: "pipe",
    stderr: "ignore",
  });
  if ((await child.exited) !== 0) {
    return null;
  }
  const relativeExclude = (await new Response(child.stdout).text()).trim();
  if (relativeExclude.length === 0) {
    return null;
  }
  return path.isAbsolute(relativeExclude)
    ? relativeExclude
    : path.resolve(cwd, relativeExclude);
}

export async function addGitExcludes(options: {
  readonly cwd: string;
  readonly patterns: readonly string[];
}): Promise<readonly string[]> {
  const excludePath = await gitExcludePath(options.cwd);
  if (excludePath === null) {
    return [];
  }
  const excludeFile = Bun.file(excludePath);
  const existing = (await excludeFile.exists()) ? await excludeFile.text() : "";
  const lines = existing.split("\n").map((line) => line.trim());
  const missing = options.patterns.filter(
    (pattern) => !lines.includes(pattern),
  );
  if (missing.length === 0) {
    return [];
  }
  await mkdir(path.dirname(excludePath), { recursive: true });
  const prefix =
    existing.length > 0 && !existing.endsWith("\n") ? `${existing}\n` : existing;
  await Bun.write(excludePath, `${prefix}${missing.join("\n")}\n`);
  return missing;
}

export async function removeGitExcludes(options: {
  readonly cwd: string;
  readonly patterns: readonly string[];
}): Promise<void> {
  if (options.patterns.length === 0) {
    return;
  }
  const excludePath = await gitExcludePath(options.cwd);
  if (excludePath === null) {
    return;
  }
  const excludeFile = Bun.file(excludePath);
  if (!(await excludeFile.exists())) {
    return;
  }
  const existing = await excludeFile.text();
  const kept = existing
    .split("\n")
    .filter((line) => !options.patterns.includes(line.trim()));
  const trailing = existing.endsWith("\n") && kept.at(-1) === "" ? "" : "\n";
  await Bun.write(excludePath, `${kept.join("\n")}${trailing}`);
}

export async function removeArtifacts(options: {
  readonly directory: string;
  readonly artifacts: readonly InstalledArtifact[];
}): Promise<number> {
  let removed = 0;
  for (const artifact of options.artifacts) {
    const artifactPath = await resolveArtifactPath({
      root: options.directory,
      relativePath: artifactRelativePaths[artifact],
    });
    if (artifactPath === null) {
      continue;
    }
    if (await Bun.file(artifactPath).exists()) {
      removed += 1;
    }
    await rm(artifactPath, { force: true });
  }
  const leafDirectory = await resolveArtifactPath({
    root: options.directory,
    relativePath: ownedLeafDirectory,
  });
  if (leafDirectory !== null) {
    await rmdir(leafDirectory).catch(() => undefined);
  }
  return removed;
}
