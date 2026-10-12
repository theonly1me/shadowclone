import { expect, test } from "bun:test";
import path from "node:path";
import { integrationFixture } from "@shadowclone/core/testing";
import { replaceLocalText } from "@shadowclone/core";
import { applyRevisionFiles } from "./apply";

test("a later write failure rolls back the files already changed", async () => {
  const { home } = await integrationFixture();
  const root = path.join(home, ".agents/skills");
  const filePath = path.join(root, "naming/SKILL.md");
  const before = "Use complete names.\n";

  await Bun.write(filePath, before);
  let writes = 0;

  await expect(
    applyRevisionFiles({
      revision: {
        id: crypto.randomUUID(),
        root,
        kind: "skill",
        status: "prepared",
        createdAt: Date.now(),
        changes: [
          { relativePath: "naming/SKILL.md", before, after: "Changed" },
          {
            relativePath: "workflow/SKILL.md",
            before: null,
            after: "New guidance",
          },
        ],
      },
      replace: async (change) => {
        writes += 1;

        if (writes === 2) {
          throw new Error("Fixture disk failure");
        }

        await replaceLocalText(change);
      },
    }),
  ).rejects.toThrow("Fixture disk failure");
  expect(writes).toBe(2);
  expect(await Bun.file(filePath).text()).toBe(before);
});
