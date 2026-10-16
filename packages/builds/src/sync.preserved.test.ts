import { expect, test } from "bun:test";
import path from "node:path";
import { listRevisions } from "@shadowclone/changes";
import type { ProjectPaths } from "@shadowclone/core";
import {
  installIntegration,
  syncLearningEnvironment,
  undoRevision,
  type ReplacedRouting,
  type SkippedRouting,
} from "@shadowclone/environment";
import { installedBuild } from "./syncFixtures";

async function editedCodexInstructions() {
  const setup = await installedBuild();

  await installIntegration({ paths: setup.paths, cwd: setup.cwd, agent: "codex", scope: "global" });

  const instructions = path.join(setup.home, ".codex/AGENTS.md");
  const installed = await Bun.file(instructions).text();

  if (!installed.includes("<shadowclone-guidance>\n")) {
    throw new Error("The codex install wrote no shadowclone section");
  }

  const edited = `# My notes\n${installed.replace("<shadowclone-guidance>\n", "<shadowclone-guidance>\nMy own routing line\n")}`;

  await Bun.write(instructions, edited);

  return { ...setup, instructions, edited };
}

async function syncReporting(options: { readonly paths: ProjectPaths; readonly replaceEdited?: boolean }) {
  const skipped: SkippedRouting[] = [];
  const replaced: ReplacedRouting[] = [];
  const synchronized = await syncLearningEnvironment(options.paths, {
    onSkipped: (entries) => skipped.push(...entries),
    onReplaced: (entries) => replaced.push(...entries),
    replaceEdited: options.replaceEdited,
  });

  return { synchronized, skipped, replaced };
}

test("sync names the edited instruction file and the reason, and keeps the edit", async () => {
  const setup = await editedCodexInstructions();

  expect(await syncReporting({ paths: setup.paths })).toEqual({
    synchronized: true,
    replaced: [],
    skipped: [
      { kind: "preserved", agent: "codex", path: setup.instructions, reason: "editedManagedContent" },
    ],
  });
  expect(await Bun.file(setup.instructions).text()).toBe(setup.edited);
});

test("sync --replace-edited replaces only the shadowclone section, and undo restores the edit", async () => {
  const setup = await editedCodexInstructions();

  expect(await syncReporting({ paths: setup.paths, replaceEdited: true })).toEqual({
    synchronized: true,
    skipped: [],
    replaced: [{ agent: "codex", path: setup.instructions }],
  });

  const replaced = await Bun.file(setup.instructions).text();

  expect(replaced.startsWith("# My notes\n")).toBeTrue();
  expect(replaced).not.toContain("My own routing line");
  expect(replaced).toContain(": verify-and-review");

  const [latest] = [...(await listRevisions(setup.paths))].sort(
    (first, second) => second.createdAt - first.createdAt,
  );

  if (!latest) throw new Error("The replacing sync recorded no revision");

  await undoRevision({ paths: setup.paths, id: latest.id });

  expect(await Bun.file(setup.instructions).text()).toBe(setup.edited);
});

test("after a replacement, the next sync updates the agent without skipping it", async () => {
  const setup = await editedCodexInstructions();

  await syncReporting({ paths: setup.paths, replaceEdited: true });

  expect(await syncReporting({ paths: setup.paths })).toEqual({
    synchronized: true,
    skipped: [],
    replaced: [],
  });
});

function withSortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withSortedKeys);
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, withSortedKeys(Reflect.get(value, key))]),
  );
}

test("hooks that another tool rewrote with sorted keys still belong to shadowclone", async () => {
  const setup = await installedBuild();

  await installIntegration({ paths: setup.paths, cwd: setup.cwd, agent: "antigravity", scope: "global" });

  const hooksFile = path.join(setup.home, ".gemini/config/hooks.json");
  const installed: unknown = JSON.parse(await Bun.file(hooksFile).text());

  await Bun.write(hooksFile, `${JSON.stringify(withSortedKeys(installed), null, 2)}\n`);

  expect(await syncReporting({ paths: setup.paths })).toEqual({
    synchronized: true,
    skipped: [],
    replaced: [],
  });

  const commands = (await Bun.file(hooksFile).text()).match(/hook native-start/g) ?? [];

  expect(commands).toHaveLength(1);
});
