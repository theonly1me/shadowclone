import { expect, test } from "bun:test";
import path from "node:path";
import { integrationFixture } from "@shadowclone/core/testing";
import { commitLocalChanges, listRevisions, showRevision } from "./index";

test("revision checks every destination before mutating any file", async () => {
  const { paths, home } = await integrationFixture();
  const root = path.join(home, ".agents/skills");
  const first = path.join(root, "naming/SKILL.md");
  const second = path.join(root, "workflow/SKILL.md");

  await Bun.write(first, "Use complete names.\n");

  await expect(
    commitLocalChanges({
      paths,
      root,
      kind: "skill",
      updates: [
        { filePath: first, next: "new" },
        { filePath: second, next: "new", previous: "Changed elsewhere" },
      ],
    }),
  ).rejects.toThrow("subsequent edits");
  expect(await Bun.file(first).text()).toContain("Use complete names");
  expect(await listRevisions(paths)).toEqual([]);
});

test("history details redact private skill text", async () => {
  const { paths, home } = await integrationFixture();
  const secret = `sk-ant-${"A".repeat(90)}`;
  const root = path.join(home, ".agents/skills");
  const filePath = path.join(root, "naming/SKILL.md");

  await Bun.write(filePath, `Private fixture ${secret}\n`);

  const id = await commitLocalChanges({
    paths,
    root,
    kind: "skill",
    updates: [{ filePath, next: "Replacement" }],
  });

  if (!id) {
    throw new Error("Expected a revision");
  }

  const details = await showRevision({ paths, id });

  expect(details).toContain("naming/SKILL.md");
  expect(details).toContain("Replacement");
  expect(details).not.toContain(secret);
});
