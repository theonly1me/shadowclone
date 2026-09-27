import path from "node:path";
import type { ProjectPaths } from "../../../paths";
import { renderReference, referenceRelativePath } from "../../../references";
import { command } from "../../transfer/command";
import { correctedPath, incorrectPath } from "./change";

export async function prepareReferenceFixture(fixture: {
  readonly paths: ProjectPaths;
  readonly directory: string;
}) {
  const record = {
    schema: 1 as const,
    key: "reference_second_source",
    title: "Second source",
    summary: "Use the documented command.",
    tags: [],
    source: "claude-memory" as const,
    sourceLocator: "synthetic/reference.md",
    updatedAt: "2026-09-19T00:00:00.000Z",
    scope: "global" as const,
    originDirectory: null,
    repositoryName: null,
    body: `Mock used exports. See ${incorrectPath}.`,
  };

  const referenceContent = renderReference(record);
  const relativePath = referenceRelativePath(record);
  const referenceFile = path.join(fixture.paths.profileDirectory, relativePath);

  await Bun.write(referenceFile, referenceContent);
  await Bun.write(
    path.join(fixture.directory, correctedPath),
    "export const testName = true;\n",
  );
  await command({
    arguments: ["git", "add", "--", correctedPath],
    cwd: fixture.directory,
  });
  await command({
    arguments: [
      "git",
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=fixture@localhost",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "Synthetic path evidence",
    ],
    cwd: fixture.directory,
  });

  const baseCommit = await command({
    arguments: ["git", "rev-parse", "HEAD"],
    cwd: fixture.directory,
  });

  return { referenceContent, referenceFile, baseCommit };
}
