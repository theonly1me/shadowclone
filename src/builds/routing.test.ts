import { expect, test } from "bun:test";
import { environmentCompilation } from "../environment/context";
import { loadSeedLibrary } from "../skills/library";
import { applyBuild } from "./apply";
import { buildFixture, buildInput } from "./fixtures";
import { previewBuild } from "./plan";

const nativeRoutingLimit = 4096;
const userRoutingReserve = 1024;

test("a build with every bundled skill and preference leaves 1 KiB of routing for the user's own rules", async () => {
  const context = await buildFixture();
  const library = await loadSeedLibrary();
  const choices = Object.fromEntries([
    ...library.independentSkills.map((skill) => [skill.id, true] as const),
    ...library.axes.flatMap((axis) =>
      axis.guidance[0] ? [[axis.guidance[0].id, true] as const] : [],
    ),
  ]);

  await applyBuild({
    ...context,
    plan: await previewBuild({ ...context, input: buildInput({ choices }) }),
  });

  const compilation = await environmentCompilation({
    ...context,
    originDirectory: null,
    repositoryName: null,
  });

  expect(Buffer.byteLength(compilation?.markdown ?? "")).toBeLessThanOrEqual(
    nativeRoutingLimit - userRoutingReserve,
  );
  expect(compilation?.markdown).toContain(
    "- before you say that work is done or ready for review: verify-and-review",
  );
});
