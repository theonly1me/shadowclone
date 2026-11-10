import { expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, realpath, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkoutRoot } from "@shadowclone/core/testing";

async function runCli(options: {
  readonly home: string;
  readonly arguments: readonly string[];
  readonly input?: string;
}) {
  const child = Bun.spawn([process.execPath, path.join(import.meta.dir, "main.ts"), ...options.arguments], {
    cwd: await checkoutRoot(),
    env: { ...process.env, HOME: options.home },
    stdin: new Blob([options.input ?? ""]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited]);

  return { output: output.trim(), exitCode };
}

function promptInput(prompt: string): string {
  return JSON.stringify({
    session_id: "briefs-session",
    hook_event_name: "UserPromptSubmit",
    cwd: "/work/app",
    prompt,
  });
}

const syntheticToken = `ghp_${"c".repeat(36)}`;

async function withHome(run: (home: string) => Promise<void>): Promise<void> {
  const home = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-live-briefs-")));

  try {
    await run(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

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
