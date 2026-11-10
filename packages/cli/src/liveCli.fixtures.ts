import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { checkoutRoot } from "@shadowclone/core/testing";

export async function runCli(options: {
  readonly home: string;
  readonly arguments: readonly string[];
  readonly input?: string;
  readonly environment?: Readonly<Record<string, string>>;
}) {
  const child = Bun.spawn([process.execPath, path.join(import.meta.dir, "main.ts"), ...options.arguments], {
    cwd: await checkoutRoot(),
    env: { ...process.env, ...options.environment, HOME: options.home },
    stdin: new Blob([options.input ?? ""]),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [output, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited]);

  return { output: output.trim(), exitCode };
}

export function promptInput(prompt: string): string {
  return JSON.stringify({
    session_id: "briefs-session",
    hook_event_name: "UserPromptSubmit",
    cwd: "/work/app",
    prompt,
  });
}

export const syntheticToken = `ghp_${"c".repeat(36)}`;

export async function withHome(run: (home: string) => Promise<void>): Promise<void> {
  const home = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-live-briefs-")));

  try {
    await run(home);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}
