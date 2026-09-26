import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installContext } from "./context";

test("delivers skill names, descriptions and locations without copying bodies", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "context-catalog-"));
  try {
    const prompt = await installContext({ directory, files: [{
      relativePath: "skills/0/clean-code/SKILL.md",
      content: "---\nname: clean-code\ndescription: Mandatory before editing code.\n---\n\nDetailed private conventions.\n",
    }] });
    expect(prompt).toContain("clean-code");
    expect(prompt).toContain("Mandatory before editing code.");
    expect(prompt).toContain(".eval-context/skills/0/clean-code/SKILL.md");
    expect(prompt).not.toContain("Detailed private conventions.");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
