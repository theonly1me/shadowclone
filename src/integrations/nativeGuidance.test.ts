import { expect, test } from "bun:test";
import path from "node:path";
import { defaultConfig, writeConfig } from "../config";
import { compileContextDetails } from "./compile";
import { integrationFixture } from "./fixtures";

test("session context omits a rule the repository instructions state only with repository guidance consent", async () => {
  const fixture = await integrationFixture();
  await Bun.write(path.join(fixture.paths.profileDirectory, "global/workflow.md"), "## Gate\n\nRun the full check script before presenting any change.\n");
  await Bun.write(path.join(fixture.cwd, "CLAUDE.md"), "# Repository\n\nRun the full check script before presenting any change.\n");
  const compile = () => compileContextDetails({ ...fixture, format: "index", nativeDuplicates: "including-harness" });

  expect((await compile())?.compilation.markdown).toContain("Run the full check script");
  await writeConfig({ configPath: fixture.paths.configFile, config: { ...defaultConfig, sources: { ...defaultConfig.sources, "declared-rules": true } } });
  const deduplicated = await compile();
  expect(deduplicated?.compilation.markdown).not.toContain("Run the full check script");
  expect(deduplicated?.compilation.markdown).toContain("- Naming: Use complete names.");
  expect(deduplicated?.compilation.omissions.map((omission) => omission.reason)).toContain("known-duplicate");
});
