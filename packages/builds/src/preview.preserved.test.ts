import { expect, test } from "bun:test";
import path from "node:path";
import { installIntegration } from "@shadowclone/environment";
import { previewBuild } from "./plan";
import { installedBuild } from "./syncFixtures";
import { buildInput } from "./testing";

test("a build preview that meets an edited agent section names the file and the command that replaces it", async () => {
  const setup = await installedBuild();

  await installIntegration({ paths: setup.paths, cwd: setup.cwd, agent: "codex", scope: "global" });

  const instructions = path.join(setup.home, ".codex/AGENTS.md");
  const installed = await Bun.file(instructions).text();

  await Bun.write(instructions, installed.replace("<shadowclone-guidance>\n", "<shadowclone-guidance>\nMy own routing line\n"));

  await expect(
    previewBuild({ ...setup, input: buildInput({ choices: { "verify-and-review": true, "tests-that-catch-bugs": true } }) }),
  ).rejects.toThrow(
    `Did not plan the build: shadowclone kept ${instructions}, because its shadowclone section changed after shadowclone wrote it. To replace the shadowclone content in it, run shadowclone sync --replace-edited, then try the build again.`,
  );
});
