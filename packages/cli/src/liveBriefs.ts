import os from "node:os";
import { briefCallsPerHour, writeMachineBrief, type MachineBriefOutcome } from "@shadowclone/briefs";
import {
  liveBriefLines,
  liveBriefListLine,
  liveConsent,
  liveDetailLines,
  liveListLine,
  liveOffReason,
  livePaths,
  machineLive,
  readBrief,
  switchTaskBriefs,
  type LiveRecord,
  type LiveTaskBriefs,
} from "@shadowclone/live";

export const taskBriefsUsage = "Usage: shadowclone live briefs enable|disable";

function startBriefWriter(id: string): void {
  Bun.spawn({
    cmd: [process.execPath, Bun.main, "live", "brief", id],
    cwd: os.homedir(),
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
    detached: true,
    env: { ...process.env, SHADOWCLONE_INTERNAL_RUN: "1" },
  }).unref();
}

export const detachedBriefWriter: LiveTaskBriefs = { startWriter: startBriefWriter };

function sessionCount(count: number): string {
  return count === 1 ? "1 session" : `${count} sessions`;
}

export async function taskBriefsCommand(arguments_: readonly string[]): Promise<void> {
  const [operation] = arguments_;

  if ((operation !== "enable" && operation !== "disable") || arguments_.length !== 1) {
    console.log(taskBriefsUsage);
    process.exitCode = 1;
    return;
  }

  const outcome = await switchTaskBriefs({ paths: livePaths(), enabled: operation === "enable" });

  switch (outcome.kind) {
    case "refused":
      console.log(outcome.reason);
      process.exitCode = 1;
      return;
    case "on":
      console.log(
        [
          "Task briefs are on. Each live session keeps a redacted copy of its first and latest prompt.",
          "After each turn, the fast model of the session's own engine writes a short brief from those prompts and the last message.",
        ].join("\n"),
      );
      return;
    case "off":
      console.log(
        `Task briefs are off. shadowclone deleted the saved prompts and briefs of ${sessionCount(outcome.removedSessions)}.`,
      );
      return;
  }
}

function briefText(options: { readonly id: string; readonly outcome: MachineBriefOutcome }): {
  readonly text: string;
  readonly failed: boolean;
} {
  const { id, outcome } = options;

  switch (outcome.kind) {
    case "off":
      return { text: "Task briefs are off. Run shadowclone live briefs enable first.", failed: true };
    case "written":
      return { text: `Wrote the brief for ${id}.`, failed: false };
    case "failed":
      return {
        text:
          outcome.reason === "model"
            ? `The model call for ${id} failed, so the earlier brief stays.`
            : `The model answer for ${id} was not a valid brief, so the earlier brief stays.`,
        failed: true,
      };
    case "skipped":
      switch (outcome.reason) {
        case "missing":
          return { text: `No live session ${id} exists on this machine.`, failed: true };
        case "busy":
          return { text: `Another brief writer runs for ${id}.`, failed: false };
        case "no-message":
          return { text: `${id} has no last message yet.`, failed: false };
        case "unchanged":
          return { text: `The last message of ${id} did not change, so the brief stays.`, failed: false };
        case "limited":
          return {
            text: `${id} had ${briefCallsPerHour} brief calls in the last hour, so the brief stays.`,
            failed: false,
          };
        case "engine-not-allowed":
          return { text: `A managed policy does not allow the engine of ${id}.`, failed: true };
      }
  }
}

export async function briefCommand(arguments_: readonly string[]): Promise<void> {
  const [id] = arguments_;

  if (id === undefined || arguments_.length !== 1) {
    console.log("Usage: shadowclone live brief <live-id>");
    process.exitCode = 1;
    return;
  }

  const { text, failed } = briefText({ id, outcome: await writeMachineBrief(id) });

  console.log(text);
  process.exitCode = failed ? 1 : 0;
}

export async function showCommand(arguments_: readonly string[]): Promise<void> {
  const [id] = arguments_;

  if (id === undefined || arguments_.length !== 1) {
    console.log("Usage: shadowclone live show <live-id>");
    process.exitCode = 1;
    return;
  }

  const consent = await liveConsent();
  const record = consent.liveSessions ? await machineLive().get(id) : null;

  if (record === null) {
    console.log(consent.liveSessions ? `No live session ${id} exists on this machine.` : liveOffReason);
    process.exitCode = 1;
    return;
  }

  const brief = consent.taskBriefs
    ? liveBriefLines({ record, brief: await readBrief({ paths: livePaths(), id }) })
    : [];

  console.log([...liveDetailLines(record), ...brief].join("\n"));
}

export async function liveListLines(records: readonly LiveRecord[]): Promise<readonly string[]> {
  if (!(await liveConsent()).taskBriefs) {
    return records.map(liveListLine);
  }

  const paths = livePaths();

  return Promise.all(
    records.map(async (record) => liveBriefListLine({ record, brief: await readBrief({ paths, id: record.id }) })),
  );
}
