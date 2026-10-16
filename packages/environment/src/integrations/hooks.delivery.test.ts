import { expect, test } from "bun:test";
import { writeConfig, defaultConfig } from "@shadowclone/core";
import { integrationFixture } from "@shadowclone/core/testing";
import { writeActiveEnvironment } from "../environment/fixtures";
import { installIntegration } from "./install";
import { nativeSessionStart } from "./hooks";
import { readIntegrations, saveIntegration } from "./state";

test("session start keeps the integration record that sync saved while the hook ran", async () => {
  const fixture = await integrationFixture();

  await writeConfig({
    configPath: fixture.paths.configFile,
    config: {
      ...defaultConfig,
      sources: { ...defaultConfig.sources, "git-metadata": true },
      distillation: { deep: true, automatic: true },
    },
  });
  await writeActiveEnvironment({ ...fixture, bodies: ["Use complete names."] });

  const installed = await installIntegration({ ...fixture, agent: "cursor", scope: "global" });
  const synchronizedFiles = installed.files.map((file) => ({
    ...file,
    fingerprint: `written-by-sync-${file.relativePath}`,
  }));
  let synchronized = false;

  await nativeSessionStart({
    ...fixture,
    id: installed.id,
    input: JSON.stringify({ workspace_roots: [fixture.cwd], conversation_id: "cursor-session" }),
    readRemote: async () => {
      if (!synchronized) {
        synchronized = true;
        await saveIntegration({
          paths: fixture.paths,
          integration: { ...installed, files: synchronizedFiles },
        });
      }

      return "https://github.com/synthetic/palettes.git";
    },
  });

  const [record] = await readIntegrations(fixture.paths);

  expect(synchronized).toBeTrue();
  expect(record?.files).toEqual(synchronizedFiles);
  expect(record?.deliveredAt).toBeNumber();
});
