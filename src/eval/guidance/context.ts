import path from "node:path";
import { mkdir } from "node:fs/promises";
import { renderSkillCatalog } from "../transfer/skillCatalog";
import type { ContextFile } from "../transfer/types";
import type { GuidanceArm, GuidanceSuite } from "./schema";

export function contextFiles(options: { readonly suite: GuidanceSuite; readonly arm: GuidanceArm }): readonly ContextFile[] {
  if (options.arm === "bare") return [];
  return [
    ...options.suite.context,
    ...(options.arm === "memory" ? options.suite.memory : []),
    ...(options.arm === "clone" ? options.suite.references : []),
  ];
}

export async function installGuidanceContext(options: {
  readonly suite: GuidanceSuite;
  readonly arm: GuidanceArm;
  readonly directory: string;
}): Promise<string> {
  const files = contextFiles(options);
  const root = path.join(options.directory, ".eval-context");
  for (const file of files) {
    const target = path.resolve(root, file.relativePath);
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error("Guidance context path escapes the snapshot");
    await mkdir(path.dirname(target), { recursive: true });
    await Bun.write(target, file.content, { mode: 0o600 });
  }
  const instructions = options.suite.context.filter((file) => file.relativePath.startsWith("instructions/"));
  return [
    options.arm === "bare" ? "" : instructions.map((file) => `Personal instruction ${file.relativePath}:\n${file.content}`).join("\n\n"),
    options.arm === "bare" ? "" : renderSkillCatalog(options.suite.context),
    options.arm === "memory" ? "Your frozen Claude memory index follows. Read linked memory files under .eval-context/memory when relevant." : "",
    options.arm === "memory" ? options.suite.memory.find((file) => file.relativePath === "memory/MEMORY.md")?.content ?? "" : "",
    options.arm === "clone" ? options.suite.bootstrap : "",
    options.arm === "clone" ? options.suite.profile : "",
    options.arm === "clone" ? "The session hook context is already loaded above. In this isolated snapshot, retrieve full references using Read at the following paths instead of calling the live Shadowclone service:" : "",
    options.arm === "clone" ? options.suite.references.map((file) => `.eval-context/${file.relativePath}`).join("\n") : "",
  ].filter(Boolean).join("\n\n");
}
