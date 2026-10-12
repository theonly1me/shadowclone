import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkoutRoot } from "@shadowclone/core/testing";
import { createProjectPaths } from "@shadowclone/core";
import { emptyEnvironment, learningRuleSchema, readEnvironment, writeEnvironment } from "@shadowclone/environment";
import { learningRecord } from "@shadowclone/environment/testing";

async function runCli(options: { readonly home: string; readonly arguments: readonly string[] }) {
  const process_ = Bun.spawn([process.execPath, path.join(import.meta.dir, "main.ts"), ...options.arguments], {
    cwd: await checkoutRoot(),
    env: { ...process.env, HOME: options.home }, stdout: "pipe", stderr: "pipe",
  });
  const [output, error, exitCode] = await Promise.all([
    new Response(process_.stdout).text(), new Response(process_.stderr).text(), process_.exited,
  ]);
  return { output, error, exitCode };
}

test("rejecting a learning without a registered repository removes it from pending for good", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "shadowclone-reject-"));
  try {
    const paths = createProjectPaths({ homeDirectory: home, platform: "darwin" });
    const record = learningRecord({ key: "mined:org-duplicate" });
    await writeEnvironment({ paths, state: { ...emptyEnvironment, records: [{
      ...record, rule: learningRuleSchema.parse({ ...record.rule, scope: "org", originDirectory: "isolated--synthetic" }),
    }] } });
    expect((await runCli({ home, arguments: ["skills", "pending"] })).output).toContain("mined:org-duplicate");

    const rejected = await runCli({ home, arguments: ["learning", "reject", "mined:org-duplicate"] });
    expect(rejected.error).toBe("");
    expect(rejected.exitCode).toBe(0);

    expect((await runCli({ home, arguments: ["skills", "pending"] })).output).not.toContain("mined:org-duplicate");
    expect((await readEnvironment(paths))?.rejected).toEqual(["mined:org-duplicate"]);
  } finally { await rm(home, { recursive: true, force: true }); }
});
