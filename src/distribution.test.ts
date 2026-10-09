import { expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isPackageRoot } from "./distribution";

async function packageTree(options: {
  readonly name: string;
  readonly folders: readonly string[];
}): Promise<string> {
  const rootDirectory = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-root-")));

  await Bun.write(path.join(rootDirectory, "package.json"), JSON.stringify({ name: options.name }));

  for (const folder of options.folders) {
    await mkdir(path.join(rootDirectory, folder));
  }

  return rootDirectory;
}

test("the package root is found by its name, without depending on any one bundled skill", async () => {
  expect(
    await isPackageRoot(
      await packageTree({ name: "@shadowclone/cli", folders: ["skills", "preferences"] }),
    ),
  ).toBeTrue();
  expect(
    await isPackageRoot(
      await packageTree({ name: "another-project", folders: ["skills", "preferences"] }),
    ),
  ).toBeFalse();
  expect(
    await isPackageRoot(await packageTree({ name: "@shadowclone/cli", folders: ["preferences"] })),
  ).toBeFalse();
  expect(await isPackageRoot(path.resolve(import.meta.dir, ".."))).toBeTrue();
});
