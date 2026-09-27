import { expect, test } from "bun:test";
import { mkdtemp, rm, mkdir, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { canonicalPath } from "../../../paths";
import { guidanceFixture } from "../fixtures";
import { judgeEvidencePaths } from "../judgeEvidence";
import { captureSourceJudging, historicalSources } from "../sourceEvidence";

test("source evidence rejects a repository location symlink escape", async () => {
  const directory = canonicalPath(
    await mkdtemp(path.join(os.tmpdir(), "maintenance-escape-")),
  );

  try {
    for (const sourcePath of judgeEvidencePaths) {
      await Bun.write(path.join(directory, sourcePath), "Repository fact");
    }

    await mkdir(path.join(directory, "packages"));
    await symlink(
      canonicalPath(os.tmpdir()),
      path.join(directory, "packages/example"),
    );

    const suite = {
      ...guidanceFixture(),
      memory: historicalSources.map((relativePath) => ({
        relativePath,
        content: "Historical source",
      })),
    };

    await expect(captureSourceJudging({ directory, suite })).rejects.toThrow(
      "escapes",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
