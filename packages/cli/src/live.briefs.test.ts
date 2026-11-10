import { expect, test } from "bun:test";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fingerprint } from "@shadowclone/core";
import { liveId, livePaths, readBrief, saveBrief } from "@shadowclone/live";
import { promptInput, runCli, syntheticToken, withHome } from "./liveCli.fixtures";

test("live briefs enable refuses while live sessions are off", async () => {
  await withHome(async (home) => {
    expect(await runCli({ home, arguments: ["live", "briefs", "enable"] })).toEqual({
      output: "Live sessions are off, so task briefs cannot start. Run shadowclone live enable first.",
      exitCode: 1,
    });
  });
});

test("with task briefs off, a prompt stores no task file and status prints one line", async () => {
  await withHome(async (home) => {
    await runCli({ home, arguments: ["live", "enable"] });
    await runCli({ home, arguments: ["live", "hook", "claude"], input: promptInput("Rename the parser.") });

    const files = await readdir(path.join(home, ".shadowclone", "live"));

    expect(files.filter((name) => name.endsWith(".task.json"))).toEqual([]);
    expect(await runCli({ home, arguments: ["live", "status"] })).toEqual({
      output: "Live sessions: on",
      exitCode: 0,
    });
  });
});

test("live briefs enable stores the redacted prompt with mode 0600, and disable deletes it", async () => {
  await withHome(async (home) => {
    await runCli({ home, arguments: ["live", "enable"] });

    const enabled = await runCli({ home, arguments: ["live", "briefs", "enable"] });

    await runCli({
      home,
      arguments: ["live", "hook", "claude"],
      input: promptInput(`Rename the parser. The token is ${syntheticToken}.`),
    });

    const directory = path.join(home, ".shadowclone", "live");
    const [taskFile] = (await readdir(directory)).filter((name) => name.endsWith(".task.json"));
    const taskPath = path.join(directory, taskFile ?? "missing");
    const stored = await readFile(taskPath, "utf8");
    const mode = (await stat(taskPath)).mode & 0o777;
    const status = await runCli({ home, arguments: ["live", "status"] });
    const disabled = await runCli({ home, arguments: ["live", "briefs", "disable"] });

    expect(enabled.exitCode).toBe(0);
    expect(enabled.output).toStartWith("Task briefs are on.");
    expect(stored).toContain("[redacted:github-token]");
    expect(stored).not.toContain("c".repeat(36));
    expect(mode).toBe(0o600);
    expect(status.output).toBe("Live sessions: on\nTask briefs: on");
    expect(disabled).toEqual({
      output: "Task briefs are off. shadowclone deleted the saved prompts and briefs of 1 session.",
      exitCode: 0,
    });
    expect((await readdir(directory)).filter((name) => name.endsWith(".task.json"))).toEqual([]);
  });
});

test("a stop with task briefs on starts a detached writer and returns at once", async () => {
  await withHome(async (home) => {
    const id = liveId({ engine: "claude", sessionId: "briefs-session" });
    const environment = { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin` };
    const lockFile = path.join(home, ".shadowclone", "live", `${id}.brief.lock`);

    await runCli({ home, arguments: ["live", "enable"] });
    await runCli({ home, arguments: ["live", "briefs", "enable"] });
    await runCli({ home, arguments: ["live", "hook", "claude"], input: promptInput("Rename the parser.") });
    await saveBrief({
      paths: livePaths(home),
      id,
      brief: {
        name: "Rename the parser",
        goal: "",
        done: "",
        kind: "finished",
        question: null,
        options: [],
        messageDigest: fingerprint("Done."),
        writtenAt: "2026-11-10T12:00:00.000Z",
      },
    });

    const startedAt = Date.now();
    const stop = await runCli({
      home,
      environment,
      arguments: ["live", "hook", "claude"],
      input: JSON.stringify({ session_id: "briefs-session", hook_event_name: "Stop", last_assistant_message: "Done." }),
    });
    const hookMilliseconds = Date.now() - startedAt;

    for (let attempt = 0; attempt < 30 && !(await Bun.file(lockFile).exists()); attempt += 1) {
      await Bun.sleep(100);
    }

    expect(stop).toEqual({ output: "", exitCode: 0 });
    expect(hookMilliseconds).toBeLessThan(5_000);
    expect(await Bun.file(lockFile).exists()).toBe(true);
    expect((await readBrief({ paths: livePaths(home), id }))?.name).toBe("Rename the parser");
  });
}, 20_000);
