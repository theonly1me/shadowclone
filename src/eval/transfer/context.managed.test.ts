import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { managedStart, managedEnd } from "../../integrations";
import { captureContext } from "./context";

test("isolates native managed guidance while preserving the baseline's original instructions", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "shadowclone-eval-managed-"));
  const original = "# Personal instructions\n\nUse the existing test command.\n";
  await Bun.write(path.join(home, ".codex/AGENTS.md"), `${original}${managedStart}\n# Shadowclone profile\n\nUse named exports.\n${managedEnd}`);
  await Bun.write(path.join(home, ".agents/skills/shadowclone-context/SKILL.md"), "shadowclone hook native-start");
  const context = await captureContext({ enabled: true, home, repository: "/repository", engine: "codex" });
  expect(context).toEqual([{ relativePath: "instructions/0.md", content: original }]);
});
