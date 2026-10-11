import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ownedWrite, runProcess, seedSkillsDirectory, hostEnvironment } from "@shadowclone/core";

export async function trustedGuidedHtml(data: unknown): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "shadowclone-guided-view-"));
  try {
    const input = path.join(directory, "report.json");
    const output = path.join(directory, "review.html");
    await ownedWrite({ path: input, content: JSON.stringify(data) });
    const renderer = path.join(
      await seedSkillsDirectory(),
      "guided-pr-review",
      "scripts",
      "render.mjs",
    );
    const result = await runProcess({
      arguments: [process.execPath, renderer, input, output],
      cwd: directory,
      environment: hostEnvironment(),
      timeoutMilliseconds: 30_000,
    });
    if (result.exitCode !== 0)
      throw new Error(
        "The report data cannot be rendered by this CLI version. Regenerate it with the installed guided-pr-review skill.",
      );
    return await Bun.file(output).text();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
