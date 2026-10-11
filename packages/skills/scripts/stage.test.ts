import { expect, test } from "bun:test";
import { mkdtemp, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stageSkillPackage } from "./stage";

test("the skill artifact keeps supporting files and excludes runtime source and workspace dependencies", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "skill-package-fixture-"));
  const packageDirectory = path.join(root, "packages/skills");
  await Bun.write(
    path.join(packageDirectory, "package.json"),
    JSON.stringify({
      name: "@shadowclone/skills",
      description: "Portable skills.",
      repository: { type: "git", url: "https://github.com/example/project.git" },
      license: "MIT",
      homepage: "https://example.com",
      private: true,
      exports: { ".": "./src/index.ts" },
      dependencies: { "@shadowclone/core": "workspace:*" },
    }),
  );
  await Bun.write(
    path.join(packageDirectory, "src/index.ts"),
    "export const privateRuntime = true;\n",
  );
  await Bun.write(
    path.join(root, "skills/example-workflow/SKILL.md"),
    "Synthetic portable skill.\n",
  );
  await Bun.write(
    path.join(root, "skills/example-workflow/assets/review.html"),
    "<p>Synthetic asset.</p>",
  );
  await Bun.write(path.join(root, "LICENSE"), "Synthetic license.");
  const outputDirectory = path.join(packageDirectory, "out/package");
  const manifest = await stageSkillPackage({
    packageDirectory,
    workspaceRoot: root,
    outputDirectory,
  });
  expect(manifest.name).toBe("@shadowclone/skills");
  expect(
    await Bun.file(path.join(outputDirectory, "skills/example-workflow/assets/review.html")).text(),
  ).toBe("<p>Synthetic asset.</p>");
  expect(await Bun.file(path.join(outputDirectory, "src/index.ts")).exists()).toBeFalse();
  expect(await Bun.file(path.join(outputDirectory, "package.json")).text()).not.toContain(
    "workspace:",
  );
  expect(await Bun.file(path.join(outputDirectory, "package.json")).text()).not.toContain(
    '"private"',
  );
});

test("skill staging does not delete an arbitrary output directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "skill-package-owned-"));
  const packageDirectory = path.join(root, "packages/skills");
  await Bun.write(
    path.join(packageDirectory, "package.json"),
    JSON.stringify({
      name: "@shadowclone/skills",
      description: "Portable skills.",
      repository: { type: "git", url: "https://github.com/example/project.git" },
      license: "MIT",
      homepage: "https://example.com",
    }),
  );
  await Bun.write(path.join(root, "skills/example/SKILL.md"), "Synthetic.");
  await Bun.write(path.join(root, "LICENSE"), "Synthetic.");
  const outputDirectory = path.join(root, "owned-by-user");
  const note = path.join(outputDirectory, "note.txt");
  await Bun.write(note, "Preserve this file.");
  await expect(
    stageSkillPackage({ packageDirectory, workspaceRoot: root, outputDirectory }),
  ).rejects.toThrow("only its own");
  expect(await Bun.file(note).text()).toBe("Preserve this file.");
});

test("skill staging cannot follow an output-parent link into user files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "skill-package-link-"));
  const packageDirectory = path.join(root, "packages/skills");
  await Bun.write(
    path.join(packageDirectory, "package.json"),
    JSON.stringify({
      name: "@shadowclone/skills",
      description: "Portable skills.",
      repository: { type: "git", url: "https://github.com/example/project.git" },
      license: "MIT",
      homepage: "https://example.com",
    }),
  );
  await Bun.write(path.join(root, "skills/example/SKILL.md"), "Synthetic.");
  await Bun.write(path.join(root, "LICENSE"), "Synthetic.");
  const protectedDirectory = path.join(root, "user-files");
  const protectedFile = path.join(protectedDirectory, "package", "note.txt");
  await Bun.write(protectedFile, "Keep this manual note.");
  await symlink(protectedDirectory, path.join(packageDirectory, "out"));
  await expect(
    stageSkillPackage({
      packageDirectory,
      workspaceRoot: root,
      outputDirectory: path.join(packageDirectory, "out/package"),
    }),
  ).rejects.toThrow("symbolic link");
  expect(await Bun.file(protectedFile).text()).toBe("Keep this manual note.");
});
