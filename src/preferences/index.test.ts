import { expect, test } from "bun:test";
import { listRevisions } from "../changes";
import { compileContext } from "../integrations";
import { integrationFixture } from "../integrations/fixtures";
import { runPreferenceTool } from "../mcp/preferences";
import { rememberPreference } from "./index";

test("explicit preferences are active, scoped and reversible without inference", async () => {
  const setup = await integrationFixture();
  const key = await rememberPreference({ ...setup, text: "Prefer composition for extension points.", scope: "repository" });
  expect(key).toStartWith("declared-");
  expect(await compileContext(setup)).toContain("Prefer composition");
  expect(await compileContext({ ...setup, cwd: `${setup.cwd}-other` })).not.toContain("Prefer composition");
  expect(await listRevisions(setup.paths)).toHaveLength(1);
});

test("MCP requires explicit scope and records redacted preferences", async () => {
  const setup = await integrationFixture();
  const secret = `sk-ant-${"A".repeat(90)}`;
  expect((await runPreferenceTool({ ...setup, params: { name: "shadowclone_remember", arguments: { text: "Use Bun" } } }))?.isError).toBeTrue();
  expect((await runPreferenceTool({ ...setup, params: { name: "shadowclone_remember", arguments: { text: `Never expose ${secret}`, scope: "global" } } }))?.isError).toBeFalse();
  expect(await compileContext(setup)).not.toContain(secret);
  const history = await runPreferenceTool({ ...setup, params: { name: "shadowclone_history", arguments: {} } });
  expect(history?.isError).toBeFalse();
  expect(history?.content[0]?.text).not.toContain("Never expose");
});
