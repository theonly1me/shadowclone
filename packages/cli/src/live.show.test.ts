import { expect, test } from "bun:test";
import path from "node:path";
import { briefMessageDigest, liveId, livePaths, saveBrief } from "@shadowclone/live";
import { promptInput, runCli, withHome } from "./liveCli.fixtures";

const id = liveId({ engine: "claude", sessionId: "briefs-session" });

const noAgentPath = { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin` };

async function sessionWithBrief(home: string): Promise<void> {
  await runCli({ home, arguments: ["live", "enable"] });
  await runCli({ home, arguments: ["live", "hook", "claude"], input: promptInput("Rename the parser.") });
  await runCli({
    home,
    arguments: ["live", "hook", "claude"],
    input: JSON.stringify({ session_id: "briefs-session", hook_event_name: "Stop", last_assistant_message: "Renamed it." }),
  });
  await saveBrief({
    paths: livePaths(home),
    id,
    brief: {
      name: "Rename the parser",
      goal: "The owner wants the parser renamed.",
      done: "The agent renamed it.",
      kind: "question",
      question: "Keep the old name?",
      options: ["Keep it", "Remove it"],
      messageDigest: briefMessageDigest("Renamed it."),
      writtenAt: "2026-11-10T12:00:00.000Z",
    },
  });
}

test("with task briefs off, live list and live show print no brief", async () => {
  await withHome(async (home) => {
    await sessionWithBrief(home);

    const listed = await runCli({ home, arguments: ["live", "list"] });
    const shown = await runCli({ home, arguments: ["live", "show", id] });

    expect(listed.output).toMatch(new RegExp(`^${id} idle claude \\S+ - \\S+ Renamed it\\.$`));
    expect(shown.output).not.toContain("Brief");
    expect(shown.output).toStartWith(`Live claude session ${id} in `);
  });
});

test("with task briefs on, live list adds the kind and name, and live show prints the brief", async () => {
  await withHome(async (home) => {
    await sessionWithBrief(home);
    await runCli({ home, arguments: ["live", "briefs", "enable"] });

    const listed = await runCli({ home, arguments: ["live", "list"] });
    const shown = await runCli({ home, arguments: ["live", "show", id] });

    expect(listed.output).toMatch(new RegExp(`^${id} idle claude \\S+ - \\S+ \\[question\\] Rename the parser: Renamed it\\.$`));
    expect(shown.exitCode).toBe(0);
    expect(shown.output).toEndWith(
      [
        "Brief, a summary by a model at 2026-11-10T12:00:00.000Z:",
        "Name: Rename the parser",
        "Kind: question",
        "Goal: The owner wants the parser renamed.",
        "Done: The agent renamed it.",
        "Question: Keep the old name?",
        "Option 1: Keep it",
        "Option 2: Remove it",
      ].join("\n"),
    );
  });
});

test("live brief refuses while task briefs are off, and makes no call for an unchanged message", async () => {
  await withHome(async (home) => {
    await sessionWithBrief(home);

    expect(await runCli({ home, arguments: ["live", "brief", id] })).toEqual({
      output: "Task briefs are off. Run shadowclone live briefs enable first.",
      exitCode: 1,
    });

    await runCli({ home, arguments: ["live", "briefs", "enable"] });

    expect(await runCli({ home, environment: noAgentPath, arguments: ["live", "brief", id] })).toEqual({
      output: `The last message of ${id} did not change, so the brief stays.`,
      exitCode: 0,
    });
    expect(await runCli({ home, arguments: ["live", "show", "live-ffffffff"] })).toEqual({
      output: "No live session live-ffffffff exists on this machine.",
      exitCode: 1,
    });
  });
});
