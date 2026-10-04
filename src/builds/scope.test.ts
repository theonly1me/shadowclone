import { expect, test } from "bun:test";
import path from "node:path";
import { environmentCompilation } from "../environment/context";
import { applyBuild } from "./apply";
import { buildCatalog } from "./catalog";
import { buildFixture, buildInput } from "./fixtures";
import { previewBuild } from "./plan";

test("private builds inherit custom skills and leave the repository untouched", async () => {
  const context = await buildFixture();

  const global = await previewBuild({
    ...context,
    input: buildInput({
      custom: [
        {
          name: "measure-first",
          description: "Measure changes to processing time.",
          body: "Compare the same workload before and after a change.",
        },
      ],
    }),
  });

  await applyBuild({ ...context, plan: global });

  const privateBuild = await previewBuild({
    ...context,
    input: buildInput({
      scope: "private",
      choices: { "testing-first": false },
    }),
  });

  expect(
    privateBuild.updates.every(
      (update) => !update.filePath.startsWith(`${context.cwd}/`),
    ),
  ).toBeTrue();

  await applyBuild({ ...context, plan: privateBuild });

  const compilation = await environmentCompilation({
    ...context,
    originDirectory: null,
    repositoryName: null,
  });

  expect(compilation?.markdown).toContain("Use the measure-first skill when relevant.");
  expect(compilation?.markdown).not.toContain("testing-first/SKILL.md");
  expect(
    await Bun.file(path.join(context.cwd, "AGENTS.md")).exists(),
  ).toBeFalse();
});

test("shared builds use relative routing and reject contradictory personal choices", async () => {
  const context = await buildFixture();
  const shared = await previewBuild({
    ...context,
    input: buildInput({ scope: "shared", choices: { "testing-first": true } }),
  });

  await applyBuild({ ...context, plan: shared });

  const native = await Bun.file(path.join(context.cwd, "AGENTS.md")).text();

  expect(native).toContain("- changing observable behavior with a test-first workflow: testing-first\n");
  expect(native).not.toContain(
    path.dirname(context.paths.shadowcloneDirectory),
  );

  const conflictingChoices: readonly Record<string, boolean>[] = [
    { "testing-first": false },
    { "testing-risk-based": true },
  ];

  for (const choices of conflictingChoices) {
    await expect(
      previewBuild({
        ...context,
        input: buildInput({ scope: "private", choices }),
      }),
    ).rejects.toThrow("shared requirements");
  }
});

test("repository edits do not replace the global catalog", async () => {
  const context = await buildFixture();
  const catalog = await buildCatalog({ ...context, scope: "global" });
  const testing = catalog.find((item) => item.id === "testing-first");

  if (!testing) {
    throw new Error("Missing built-in testing skill");
  }

  const input = buildInput({
    scope: "private",
    edits: {
      "testing-first": `${testing.text}\nOnly this repository uses this step.\n`,
    },
  });

  await applyBuild({
    ...context,
    plan: await previewBuild({ ...context, input }),
  });

  const global = await buildCatalog({ ...context, scope: "global" });

  expect(global.find((item) => item.id === "testing-first")?.text).toBe(
    testing.text,
  );
});
