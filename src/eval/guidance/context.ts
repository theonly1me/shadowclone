import path from "node:path";
import { mkdir } from "node:fs/promises";
import { renderSkillCatalog } from "../transfer/skillCatalog";
import type { ContextFile } from "../transfer/types";
import type { GuidanceArm, GuidanceSuite } from "./schema";

export function contextFiles(options: { readonly suite: GuidanceSuite; readonly arm: GuidanceArm }): readonly ContextFile[] {
  if (options.arm === "bare") return [];
  if (options.suite.protocol === "guidance-skills-v1") return [
    ...(options.arm === "clone" ? options.suite.maintainedContext ?? [] : options.suite.context),
    ...(options.arm === "memory" ? options.suite.memory : []),
  ];
  const referenceIndex = options.arm === "clone" && options.suite.protocol === "guidance-v2"
    ? [{ relativePath: "reference-index.md", content: options.suite.references.map((file) => {
        const title = file.content.split("\n").find((line) => line.startsWith("# "))?.slice(2) ?? file.relativePath;
        return `- ${file.relativePath}: ${title}`;
      }).join("\n") }]
    : [];
  return [
    ...options.suite.context,
    ...(options.arm === "memory" ? options.suite.memory : []),
    ...(options.arm === "clone" ? options.suite.references : []),
    ...referenceIndex,
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
    await Bun.write(target, file.encoding === "base64" ? Buffer.from(file.content, "base64") : file.content, { mode: file.mode ?? 0o600 });
  }
  const activeContext = options.suite.protocol === "guidance-skills-v1" && options.arm === "clone" ? options.suite.maintainedContext ?? [] : options.suite.context;
  const instructions = activeContext.filter((file) => file.relativePath.startsWith("instructions/"));
  return [
    options.arm === "bare" ? "" : instructions.map((file) => `Personal instruction ${file.relativePath}:\n${file.content}`).join("\n\n"),
    options.arm === "bare" ? "" : renderSkillCatalog(activeContext),
    options.arm === "memory" ? "Your frozen Claude memory index follows. Read linked memory files under .eval-context/memory when relevant." : "",
    options.arm === "memory" ? options.suite.memory.find((file) => file.relativePath === "memory/MEMORY.md")?.content ?? "" : "",
    options.arm === "clone" && options.suite.protocol !== "guidance-skills-v1" ? options.suite.bootstrap : "",
    options.arm === "clone" && options.suite.protocol !== "guidance-skills-v1" ? options.suite.profile : "",
    options.arm === "clone" && options.suite.protocol === "guidance-v2"
      ? "The session hook context is already loaded above. When project knowledge is needed, Read .eval-context/reference-index.md, then Read a relevant reference. The index stands in for on-demand Shadowclone recall in this isolated snapshot."
      : "",
    options.arm === "clone" && options.suite.protocol === "guidance-v1" ? "The session hook context is already loaded above. In this isolated snapshot, retrieve full references using Read at the following paths instead of calling the live Shadowclone service:" : "",
    options.arm === "clone" && options.suite.protocol === "guidance-v1" ? options.suite.references.map((file) => `.eval-context/${file.relativePath}`).join("\n") : "",
  ].filter(Boolean).join("\n\n");
}
