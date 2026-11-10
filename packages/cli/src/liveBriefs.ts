import os from "node:os";
import { livePaths, switchTaskBriefs, type LiveTaskBriefs } from "@shadowclone/live";

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
