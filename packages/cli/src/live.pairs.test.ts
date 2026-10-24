import { expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
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

async function startSession(options: {
  readonly home: string;
  readonly engine: "claude" | "codex";
  readonly sessionId: string;
}): Promise<void> {
  for (const event of ["SessionStart", "UserPromptSubmit"]) {
    await runCli({
      home: options.home,
      arguments: ["live", "hook", options.engine],
      input: JSON.stringify({ session_id: options.sessionId, hook_event_name: event, cwd: options.home }),
    });
  }
}

test("live pair, pairs, and unpair pair two sessions, refuse an unknown one, and end the pair", async () => {
  const home = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-live-pairs-")));

  try {
    await runCli({ home, arguments: ["live", "enable"] });
    await startSession({ home, engine: "claude", sessionId: "first-session" });
    await startSession({ home, engine: "codex", sessionId: "second-session" });

    const ids = (await runCli({ home, arguments: ["live", "list"] })).output
      .split("\n")
      .map((line) => line.split(" ")[0]);
    const [first = "", second = ""] = ids;
    const paired = await runCli({ home, arguments: ["live", "pair", first, second] });
    const pair = /as (pair-[0-9a-f]{8})/.exec(paired.output)?.[1] ?? "";
    const listed = await runCli({ home, arguments: ["live", "list"] });
    const unknown = await runCli({ home, arguments: ["live", "pair", first, "live-ffffffff"] });
    const incomplete = await runCli({ home, arguments: ["live", "pair", first] });
    const ended = await runCli({ home, arguments: ["live", "unpair", pair] });
    const after = await runCli({ home, arguments: ["live", "pairs"] });

    expect(ids).toHaveLength(2);
    expect(paired.exitCode).toBe(0);
    expect(paired.output).toStartWith(`Paired ${first} and ${second} as pair-`);
    expect(listed.output).toContain(`Pairs:\n${pair} ${first} ${second} 0 of 20 notes sent`);
    expect(unknown).toEqual({
      output: "No live session live-ffffffff exists on this machine.",
      exitCode: 1,
    });
    expect(incomplete).toEqual({ output: "Usage: shadowclone live pair <live-id> <live-id>", exitCode: 1 });
    expect(ended).toEqual({
      output: `Ended ${pair}. Its sessions can no longer send each other notes.`,
      exitCode: 0,
    });
    expect(after.output).toBe("No open pairs.");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
