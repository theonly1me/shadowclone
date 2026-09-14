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

test("ignores linked skills without reading their targets", async () => {
  const repository = await temporaryRepository();
  const target = await temporaryRepository();
  const skill = path.join(repository, ".claude", "skills", "linked");
  await mkdir(path.dirname(skill), { recursive: true });
  await Bun.write(path.join(target, "SKILL.md"), "external guidance");
  await Bun.write(path.join(repository, "CLAUDE.md"), "root guidance");
  const regularSkill = path.join(repository, ".claude", "skills", "regular", "SKILL.md");
  await mkdir(path.dirname(regularSkill), { recursive: true });
  await Bun.write(regularSkill, "regular guidance");
  await symlink(target, skill);

  const sources = await discoverRepositoryGuidance(repository);

  expect(sources.map((source) => source.relativePath)).toEqual([
    ".claude/skills/regular/SKILL.md",
    "CLAUDE.md",
  ]);
});

for (const filename of ["AGENTS.md", "CLAUDE.md", ".cursorrules"]) {
  test(`ignores a linked ${filename} root file`, async () => {
    const repository = await temporaryRepository();
    const outsideRepository = await temporaryRepository();
    const regularFilename = filename === "AGENTS.md" ? "CLAUDE.md" : "AGENTS.md";
    await Bun.write(path.join(outsideRepository, filename), "external guidance");
    await Bun.write(path.join(repository, regularFilename), "regular guidance");
    await symlink(
      path.join(outsideRepository, filename),
      path.join(repository, filename),
    );

    const sources = await discoverRepositoryGuidance(repository);

    expect(sources.map((source) => source.relativePath)).toEqual([regularFilename]);
  });
}

for (const rootName of [".agents", ".claude"]) {
  test(`ignores a linked ${rootName} parent root`, async () => {
    const repository = await temporaryRepository();
    const outsideRepository = await temporaryRepository();
    const externalSkill = path.join(outsideRepository, "skills", "external", "SKILL.md");
    await mkdir(path.dirname(externalSkill), { recursive: true });
    await Bun.write(externalSkill, "external guidance");
    await Bun.write(path.join(repository, "AGENTS.md"), "regular guidance");
    await symlink(outsideRepository, path.join(repository, rootName));

    const sources = await discoverRepositoryGuidance(repository);

    expect(sources.map((source) => source.relativePath)).toEqual(["AGENTS.md"]);
  });

  test(`ignores a linked ${rootName}/skills root`, async () => {
    const repository = await temporaryRepository();
    const outsideRepository = await temporaryRepository();
    const externalSkill = path.join(outsideRepository, "external", "SKILL.md");
    await mkdir(path.dirname(externalSkill), { recursive: true });
    await Bun.write(externalSkill, "external guidance");
    await Bun.write(path.join(repository, "AGENTS.md"), "regular guidance");
    await mkdir(path.join(repository, rootName));
    await symlink(outsideRepository, path.join(repository, rootName, "skills"));

    const sources = await discoverRepositoryGuidance(repository);

    expect(sources.map((source) => source.relativePath)).toEqual(["AGENTS.md"]);
  });
}

test("ignores a linked SKILL.md while retaining regular guidance", async () => {
  const repository = await temporaryRepository();
  const outsideRepository = await temporaryRepository();
  const linkedSkill = path.join(repository, ".agents", "skills", "linked", "SKILL.md");
  const regularSkill = path.join(repository, ".agents", "skills", "regular", "SKILL.md");
  await mkdir(path.dirname(linkedSkill), { recursive: true });
  await mkdir(path.dirname(regularSkill), { recursive: true });
  await Bun.write(path.join(outsideRepository, "SKILL.md"), "external guidance");
  await Bun.write(regularSkill, "regular guidance");
  await symlink(path.join(outsideRepository, "SKILL.md"), linkedSkill);

  const sources = await discoverRepositoryGuidance(repository);

  expect(sources.map((source) => source.relativePath)).toEqual([
    ".agents/skills/regular/SKILL.md",
  ]);
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
