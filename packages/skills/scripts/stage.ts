import { cp, lstat, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import product from "@shadowclone/core/product.json";

const contentManifestSchema = z.object({
  name: z.literal("@shadowclone/skills"),
  description: z.string().min(1),
  repository: z.object({ type: z.string(), url: z.string() }),
  license: z.string(),
  homepage: z.string(),
});

export async function stageSkillPackage(options: {
  readonly packageDirectory: string;
  readonly workspaceRoot: string;
  readonly outputDirectory: string;
}) {
  const manifest = contentManifestSchema.parse(
    await Bun.file(path.join(options.packageDirectory, "package.json")).json(),
  );
  const sources = ["skills", "LICENSE"];
  for (const source of sources) {
    if (
      !(await stat(path.join(options.workspaceRoot, source))).isDirectory() &&
      source === "skills"
    )
      throw new Error("The bundled skill directory is missing.");
  }
  const output = path.resolve(options.outputDirectory);
  if (output !== path.join(path.resolve(options.packageDirectory), "out", "package"))
    throw new Error("Skill staging writes only its own out/package directory.");
  for (const directory of [path.dirname(output), output]) {
    const existing = await lstat(directory).catch((error: unknown) => {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
      throw error;
    });
    if (existing?.isSymbolicLink())
      throw new Error("Skill staging refuses a symbolic link in its output path.");
  }
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  for (const source of sources)
    await cp(path.join(options.workspaceRoot, source), path.join(output, source), {
      recursive: true,
      dereference: false,
    });
  const published = {
    ...manifest,
    version: product.version,
    files: ["skills", "README.md", "LICENSE"],
    type: "module",
  };
  await Bun.write(path.join(output, "package.json"), JSON.stringify(published, null, 2) + "\n");
  await Bun.write(
    path.join(output, "README.md"),
    [
      "# Shadowclone skills",
      "",
      "Portable coding-agent skills. Choose skills without installing the Shadowclone CLI.",
      "",
      "Run `npx skills add theonly1me/shadowclone --list` to inspect the collection.",
      "Run `npx skills add theonly1me/shadowclone --skill guided-pr-review` to install the guided review skill.",
      "",
      "The npm artifact contains the same skill folders and supporting files that Shadowclone ships.",
      "",
      "The guided document works on its own. The optional `shadowclone review open <review.html>` command connects pending review staging.",
      "",
    ].join("\n"),
  );
  return published;
}

if (import.meta.main) {
  const packageDirectory = path.resolve(import.meta.dir, "..");
  const manifest = await stageSkillPackage({
    packageDirectory,
    workspaceRoot: path.resolve(packageDirectory, "../.."),
    outputDirectory: path.join(packageDirectory, "out/package"),
  });
  console.log(manifest.name + "@" + manifest.version + " staged in packages/skills/out/package");
}
