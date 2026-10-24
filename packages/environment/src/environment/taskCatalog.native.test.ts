import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { installIntegration } from "../integrations/install";
import { nativeSessionStart } from "../integrations/hooks";
import { integrationFilePath } from "../integrations/targets";
import { syncLearningEnvironment } from "./sync";
import { catalogFixture, description } from "./taskCatalog.fixtures";

const agents = ["claude-code", "codex", "cursor", "antigravity", "pi", "opencode"] as const;

test.each(agents)("%s receives a usable catalog lookup through native delivery", async (agent) => {
  const setup = await catalogFixture();
  try {
    const integration = await installIntegration({ ...setup, agent, scope: "global" });
    await syncLearningEnvironment(setup.paths);
    const context = await nativeSessionStart({
      ...setup,
      id: integration.id,
      input: JSON.stringify({ cwd: setup.cwd, session_id: "synthetic-catalog-session" }),
    });
    const installed = await Promise.all(
      integration.files.map((file) => Bun.file(integrationFilePath({ integration, file })).text()),
    );
    const delivered = [...installed, JSON.stringify(context)].join("\n");
    expect(delivered).toContain(setup.catalogPath);
    expect(delivered).not.toContain(description);
    expect(await Bun.file(setup.catalogPath).text()).toContain(description);
  } finally {
    await rm(setup.home, { recursive: true, force: true });
  }
});
