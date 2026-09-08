import { expect, test } from "bun:test";
import { mkdir, mkdtemp, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  discoverRepositoryGuidance,
  maximumGuidanceBytes,
  maximumGuidanceFiles,
} from "./discovery";

async function temporaryRepository(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "shadowclone-guidance-"));
}

test("discovers the fixed cross-agent repository guidance set", async () => {
  const repository = await temporaryRepository();
  const files = [
    "AGENTS.md",
    "CLAUDE.md",
    ".cursorrules",
    ".agents/skills/review/SKILL.md",
    ".claude/skills/plan/SKILL.md",
  ];
  for (const relativePath of files) {
    const filePath = path.join(repository, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await Bun.write(filePath, "guidance");
  }

  const sources = await discoverRepositoryGuidance(repository);

  expect(sources.map((source) => source.relativePath)).toEqual([
    ".agents/skills/review/SKILL.md",
    ".claude/skills/plan/SKILL.md",
    ".cursorrules",
    "AGENTS.md",
    "CLAUDE.md",
  ]);
});

test("excludes nested, unrelated, empty, and generated skill files", async () => {
  const repository = await temporaryRepository();
  const files = [
    ".claude/skills/nested/child/SKILL.md",
    ".claude/skills/notes/README.md",
    ".claude/skills/shadowclone/SKILL.md",
  ];
  for (const relativePath of files) {
    const filePath = path.join(repository, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await Bun.write(filePath, "ignored");
  }
  await Bun.write(path.join(repository, "AGENTS.md"), "");

  expect(await discoverRepositoryGuidance(repository)).toEqual([]);
});

test("rejects symbolic links without exposing their paths", async () => {
  const repository = await temporaryRepository();
  const target = path.join(repository, "target");
  const skill = path.join(repository, ".claude", "skills", "linked");
  await mkdir(path.dirname(skill), { recursive: true });
  await mkdir(target);
  await symlink(target, skill);

  await expect(discoverRepositoryGuidance(repository)).rejects.toThrow(
    "Repository guidance contains a symbolic link",
  );
});

test("rejects an unsupported root guidance entry", async () => {
  const repository = await temporaryRepository();
  await mkdir(path.join(repository, "CLAUDE.md"));

  await expect(discoverRepositoryGuidance(repository)).rejects.toThrow(
    "Repository guidance contains an unsupported entry",
  );
});

test("rejects a batch above the supported file count", async () => {
  const repository = await temporaryRepository();
  for (let index = 0; index <= maximumGuidanceFiles; index += 1) {
    const filePath = path.join(
      repository,
      ".agents",
      "skills",
      `skill-${index}`,
      "SKILL.md",
    );
    await mkdir(path.dirname(filePath), { recursive: true });
    await Bun.write(filePath, "x");
  }

  await expect(discoverRepositoryGuidance(repository)).rejects.toThrow(
    "Repository guidance exceeds the supported file count",
  );
});

test("rejects a batch above the supported byte limit", async () => {
  const repository = await temporaryRepository();
  await Bun.write(
    path.join(repository, "CLAUDE.md"),
    "x".repeat(maximumGuidanceBytes + 1),
  );

  await expect(discoverRepositoryGuidance(repository)).rejects.toThrow(
    "Repository guidance exceeds the supported byte limit",
  );
});
