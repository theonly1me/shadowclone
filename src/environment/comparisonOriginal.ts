import path from "node:path";
import type { z } from "zod";
import { assertRegularDestination } from "../localFiles";
import { stripManagedGuidance } from "../integrations";
import type { ContextFile } from "../eval/transfer/types";
import { type baselineSchema, capturedFile } from "./comparisonFiles";

export async function captureOriginalSkills(options: {
  readonly manifest: z.infer<typeof baselineSchema>;
  readonly baselineDirectory: string;
  readonly repository: string;
}): Promise<ContextFile[]> {
  const { manifest, baselineDirectory } = options;
  const original: ContextFile[] = [];

  for (const file of manifest.files) {
    const [kind, id, ...parts] = file.relativePath.split("/");
    const skill =
      kind === "skills"
        ? manifest.skills.find((entry) => entry.id === id)
        : null;

    if (
      skill &&
      ((skill.scope === "repository" && skill.cwd !== options.repository) ||
        ["shadowclone-context", "shadowclone"].includes(skill.name))
    ) {
      continue;
    }

    if (
      !skill &&
      (!/^(?:AGENTS(?:\.override)?|CLAUDE)\.md$/.test(
        path.basename(file.source),
      ) ||
        (file.scope === "repository" && file.cwd !== options.repository))
    ) {
      continue;
    }

    const source = path.resolve(baselineDirectory, file.relativePath);

    if (!source.startsWith(`${baselineDirectory}${path.sep}`)) {
      throw new Error("Unsafe original baseline entry");
    }

    assertRegularDestination(source);

    if (
      new Bun.CryptoHasher("sha256")
        .update(await Bun.file(source).arrayBuffer())
        .digest("hex") !== file.hash
    ) {
      throw new Error("Original baseline changed after migration");
    }

    const relativePath = skill
      ? `skills/${id}/${skill.name}/${parts.join("/")}`
      : `instructions/${original.length}/${path.basename(file.source)}`;
    const captured = await capturedFile({ filePath: source, relativePath });

    original.push(
      skill
        ? captured
        : { ...captured, content: stripManagedGuidance(captured.content) },
    );
  }

  return original;
}
