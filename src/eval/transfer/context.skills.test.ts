import { expect, test } from "bun:test";
import path from "node:path";
import { fixtureSkill, skillFixture } from "../../skillMaintenance/fixtures";
import { renderMaintainedSkill } from "../../skillMaintenance/render";
import { captureContext } from "./context";
import { isolateNativeGuidance } from "./nativeIsolation";

test("frozen clone context includes maintained skills and generated companions", async () => {
  const setup = await skillFixture();
  const maintained = renderMaintainedSkill({
    original: setup.original,
    description: "New learned routing for implementation tasks.",
    passages: ["A learned preference from a future session."],
  });

  await Bun.write(setup.filePath, maintained);
  await Bun.write(
    path.join(setup.home, ".claude/skills/typed-changes/SKILL.md"),
    maintained,
  );
  await Bun.write(
    path.join(
      setup.home,
      ".claude/skills/shadowclone-local-generated/SKILL.md",
    ),
    fixtureSkill("shadowclone-local-generated"),
  );

  const frozen = await captureContext({
    enabled: true,
    home: setup.home,
    repository: setup.cwd,
    engine: "claude-code",
  });

  expect(frozen).toHaveLength(2);
  expect(
    frozen.some((file) =>
      file.content.includes("A learned preference from a future session."),
    ),
  ).toBeTrue();
  expect(
    frozen.some((file) =>
      file.relativePath.includes("shadowclone-local-generated"),
    ),
  ).toBeTrue();
});

test("Claude context uses its native copy without the portable source", async () => {
  const setup = await skillFixture();
  const portable = path.join(
    setup.home,
    ".agents/skills/typed-changes/SKILL.md",
  );

  await Bun.write(portable, `${setup.original}\nPortable-only change.\n`);

  const frozen = await captureContext({
    enabled: true,
    home: setup.home,
    repository: setup.cwd,
    engine: "claude-code",
  });

  expect(
    frozen.filter((file) =>
      file.relativePath.endsWith("typed-changes/SKILL.md"),
    ),
  ).toHaveLength(1);
  expect(frozen[0]?.content).toBe(setup.original);
});

test("Codex context uses portable skills and built-in system skills", async () => {
  const setup = await skillFixture();

  await Bun.write(
    path.join(setup.home, ".agents/skills/typed-changes/SKILL.md"),
    setup.original,
  );
  await Bun.write(
    path.join(setup.home, ".codex/skills/typed-changes/SKILL.md"),
    `${setup.original}\nLegacy Codex variant.\n`,
  );
  await Bun.write(
    path.join(setup.home, ".codex/skills/.system/system-skill/SKILL.md"),
    fixtureSkill("system-skill"),
  );

  const frozen = await captureContext({
    enabled: true,
    home: setup.home,
    repository: setup.cwd,
    engine: "codex",
  });

  expect(frozen).toHaveLength(2);
  expect(
    frozen.some((file) => file.content.includes("Legacy Codex variant")),
  ).toBeFalse();
  expect(
    frozen.some((file) => file.relativePath.includes("system-skill")),
  ).toBeTrue();
});

test("repository snapshots strip maintained additions before either eval arm runs", async () => {
  const setup = await skillFixture({ scope: "repository" });

  await Bun.write(
    setup.filePath,
    renderMaintainedSkill({
      original: setup.original,
      description: "",
      passages: ["A learned preference from a future session."],
    }),
  );

  const companion = path.join(
    setup.cwd,
    ".agents/skills/shadowclone-local-generated/SKILL.md",
  );

  await Bun.write(companion, fixtureSkill("shadowclone-local-generated"));
  await isolateNativeGuidance(setup.cwd);

  expect(await Bun.file(setup.filePath).text()).toBe(setup.original);
  expect(await Bun.file(companion).exists()).toBeFalse();
});
