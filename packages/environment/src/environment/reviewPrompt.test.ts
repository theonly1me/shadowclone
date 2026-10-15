import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import path from "node:path";
import { installIntegration } from "../integrations/install";
import { nativeSessionStart } from "../integrations/hooks";
import { learningRecord } from "./fixtures";
import { recordFingerprint } from "./records";
import { writeEnvironment } from "./store";
import { skillFixture } from "./testing";
import { emptyEnvironment, type LearningRecord } from "./types";

function waitingForReview(records: readonly LearningRecord[]) {
  return {
    ...emptyEnvironment,
    phase: "active" as const,
    records: [...records],
    dispositions: records.map((record) => ({
      scope: "global", key: record.rule.key, inputFingerprint: recordFingerprint(record),
      status: "pending" as const, reason: "Publication needs review of destination ownership.", destinations: [],
    })),
  };
}

test("session start defers waiting proposals until the task is done, once, and again only when they change", async () => {
  const setup = await skillFixture();
  try {
    const first = learningRecord({ key: "mined:first", body: "Run the tally checks before you push." });
    await writeEnvironment({ paths: setup.paths, state: waitingForReview([first]) });
    const integration = await installIntegration({ ...setup, agent: "claude-code", scope: "global" });
    const start = async () => JSON.stringify(await nativeSessionStart({
      ...setup, id: integration.id, input: JSON.stringify({ cwd: setup.cwd, session_id: "synthetic-session" }),
    }));

    const announced = await start();
    expect(announced).toContain("shadowclone has 1 proposal(s) that need the user's decision.");
    expect(announced).toContain("Do not mention them while the user's task is in progress.");
    expect(announced).not.toContain("first request");
    expect(await start()).not.toContain("need the user's decision");

    const second = learningRecord({ key: "mined:second", body: "Keep release notes short." });
    await writeEnvironment({ paths: setup.paths, state: waitingForReview([first, second]) });
    expect(await start()).toContain("shadowclone has 2 proposal(s) that need the user's decision.");

    const skill = await Bun.file(path.join(setup.home, ".claude/skills/shadowclone-context/SKILL.md")).text();
    expect(skill).toContain("Never add a proposal to a question about the user's task.");
    expect(skill).toContain("\"shadowclone proposed learnings from its findings. Do you want to review and approve them in this session?\"");
    expect(skill).toContain("If the user says no or does not answer, do not mention the proposals again in this session.");
  } finally { await rm(setup.home, { recursive: true, force: true }); }
});
