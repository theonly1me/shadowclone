import { expect, test } from "bun:test";
import path from "node:path";
import { undoRevision } from "../changes";
import { applySkillProposal } from "./apply";
import { skillExecution, skillFixture } from "./fixtures";
import { removeSkillMaintenance, skillRevisionRoots } from "./lifecycle";
import { listSkillProposals } from "./proposals";
import { readMaintenanceState } from "./state";
import { updateSkillLibrary } from "./update";

test("third-party packages stay unchanged while approved companions are local and reversible", async () => {
  const setup = await skillFixture({ thirdParty: true });
  expect(await updateSkillLibrary({ ...setup, execution: skillExecution() })).toMatchObject({ pending: 1, applied: 0 });
  const [proposal] = await listSkillProposals(setup.paths);
  if (!proposal) throw new Error("Expected a companion proposal");
  const revision = await applySkillProposal({ ...setup, id: proposal.id });
  const state = await readMaintenanceState(setup.paths);
  const [tracked] = state.tracked;
  const root = state.roots.find((entry) => entry.id === tracked?.rootId);
  if (!root || !tracked || !revision) throw new Error("Expected companion state and history");
  const companion = path.join(root.destination, tracked.relativePath);
  expect(await Bun.file(setup.filePath).text()).toBe(setup.original);
  expect(await Bun.file(companion).text()).toContain("installed typed-changes skill");
  await undoRevision({ paths: setup.paths, id: revision, skillRoots: await skillRevisionRoots(setup.paths) });
  expect(await Bun.file(companion).exists()).toBeFalse();
  expect(await Bun.file(setup.filePath).text()).toBe(setup.original);
});

test("forget restores original user skills and removes only recorded companions", async () => {
  const setup = await skillFixture();
  await updateSkillLibrary({ ...setup, execution: skillExecution() });
  const [proposal] = await listSkillProposals(setup.paths);
  if (!proposal) throw new Error("Expected a skill proposal");
  await applySkillProposal({ ...setup, id: proposal.id });
  expect(await removeSkillMaintenance(setup.paths)).toBe(1);
  expect(await Bun.file(setup.filePath).text()).toBe(setup.original);
});
