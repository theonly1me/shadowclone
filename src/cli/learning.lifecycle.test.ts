import { expect, test } from "bun:test";
import path from "node:path";
import { preferenceEditFixture } from "../learning/testing";

test("the CLI keeps the complete replacement text in a preview", async () => {
  const { home, record } = await preferenceEditFixture();
  const process_ = Bun.spawn([process.execPath, path.join(import.meta.dir, "index.ts"), "learning", "replace", record.rule.key,
    "Use complete words for palette labels."], {
    cwd: path.resolve(import.meta.dir, "../.."),
    env: { ...process.env, HOME: home }, stdout: "pipe", stderr: "pipe",
  });
  const [output, error, exitCode] = await Promise.all([
    new Response(process_.stdout).text(), new Response(process_.stderr).text(), process_.exited,
  ]);
  expect(error).toBe("");
  expect(exitCode).toBe(0);
  expect(output).toContain("Use complete words for palette labels.");
  expect(output).toContain("Preview only");
});
