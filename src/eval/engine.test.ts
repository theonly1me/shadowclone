import { expect, test } from "bun:test";
import { selectEvalRunner } from "./engine";

const probe = () => Promise.resolve(false);

test("rejects an engine the managed policy does not allow", async () => {
  await expect(
    selectEvalRunner({
      requested: "codex",
      allowedEngines: ["claude-code"],
    }),
  ).rejects.toThrow("Managed policy does not allow the codex engine");
});

test("explains why a requested engine cannot run eval", async () => {
  await expect(
    selectEvalRunner({
      requested: "antigravity",
      allowedEngines: ["antigravity"],
      probe,
    }),
  ).rejects.toThrow(
    "The antigravity engine cannot run eval because it is not installed",
  );
});

test("falls back to the generic message with no requested engine", async () => {
  await expect(
    selectEvalRunner({
      requested: null,
      allowedEngines: [],
      probe,
    }),
  ).rejects.toThrow("No authenticated agent engine is available for eval");
});
