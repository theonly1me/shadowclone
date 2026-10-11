import path from "node:path";
import { seedSkillsDirectory } from "@shadowclone/core";
import { draftFixture } from "./fixtures";
import { serveGuidedReview } from "./index";

export async function guidedServerFixture() {
  const fixture = await draftFixture();
  const source = path.join(fixture.directory, "report.json");
  const file = path.join(fixture.directory, "report.html");
  await Bun.write(source, JSON.stringify(fixture.data));
  const renderer = path.join(
    await seedSkillsDirectory(),
    "guided-pr-review",
    "scripts",
    "render.mjs",
  );
  const rendered = Bun.spawnSync([process.execPath, renderer, source, file], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (rendered.exitCode !== 0) throw new Error(rendered.stderr.toString());
  const voiceFile = path.join(fixture.directory, "voice.md");
  await Bun.write(voiceFile, fixture.options.guidance);
  const server = await serveGuidedReview({
    ...fixture.options,
    file,
    voiceFile,
    managedConfigFile: null,
  });
  const headers = {
    Origin: server.origin,
    "Content-Type": "application/json",
    "X-Shadowclone-Token": server.token,
  };
  return { ...fixture, file, server, headers };
}
