import { mkdir } from "node:fs/promises";
import path from "node:path";

async function excludeGitPath(options: {
  readonly cwd: string;
  readonly relativePath: string;
}): Promise<void> {
  const child = Bun.spawn({
    cmd: ["git", "-C", options.cwd, "rev-parse", "--git-path", "info/exclude"],
    stdout: "pipe",
    stderr: "ignore",
  });
  if ((await child.exited) !== 0) {
    return;
  }
  const relativeExclude = (await new Response(child.stdout).text()).trim();
  if (relativeExclude.length === 0) {
    return;
  }
  const excludePath = path.isAbsolute(relativeExclude)
    ? relativeExclude
    : path.resolve(options.cwd, relativeExclude);
  const excludeFile = Bun.file(excludePath);
  const existing = (await excludeFile.exists()) ? await excludeFile.text() : "";
  if (existing.includes(options.relativePath)) {
    return;
  }
  await mkdir(path.dirname(excludePath), { recursive: true });
  const prefix =
    existing.length > 0 && !existing.endsWith("\n") ? `${existing}\n` : existing;
  await Bun.write(excludePath, `${prefix}${options.relativePath}\n`);
}

export function renderAgent(options: {
  readonly profile: string;
  readonly name?: string;
}): string {
  const name = options.name ?? "shadowclone";
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error("Agent name must use lowercase letters, numbers, and hyphens");
  }
  return [
    "---",
    `name: ${name}`,
    "description: A copy of the user that follows their learned engineering profile",
    "model: inherit",
    "tools: Read, Grep, Glob, Bash, Edit, Write",
    "---",
    "",
    options.profile.trim(),
    "",
  ].join("\n");
}

export async function writeAgent(options: {
  readonly targetDirectory: string;
  readonly profile: string;
  readonly name?: string;
}): Promise<string> {
  const name = options.name ?? "shadowclone";
  const agentsDirectory = path.join(
    options.targetDirectory,
    ".claude",
    "agents",
  );
  const outputPath = path.join(agentsDirectory, `${name}.md`);
  await mkdir(agentsDirectory, { recursive: true });
  await Bun.write(outputPath, renderAgent(options));
  const relativeAgentPath = path.join(".claude", "agents", `${name}.md`);
  await excludeGitPath({
    cwd: options.targetDirectory,
    relativePath: relativeAgentPath,
  });
  return outputPath;
}
