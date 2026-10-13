import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { commitMessageHook, prePushHook } from "./workspace";

let root = "";

async function git(options: { readonly cwd: string; readonly arguments: readonly string[] }) {
  const child = Bun.spawn(["git", ...options.arguments], {
    cwd: options.cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1", HOME: root },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  return { stdout, stderr, exitCode };
}

async function hook(options: {
  readonly repository: string;
  readonly name: string;
  readonly content: string;
}) {
  const file = path.join(options.repository, ".git", "hooks", options.name);

  await writeFile(file, options.content);
  await chmod(file, 0o755);
}

async function repositoryWithOrigin(name: string): Promise<string> {
  const origin = path.join(root, `${name}.git`);
  const repository = path.join(root, name);

  await git({
    cwd: root,
    arguments: ["init", "--quiet", "--bare", "--initial-branch=main", origin],
  });
  await git({ cwd: root, arguments: ["clone", "--quiet", origin, repository] });
  await git({ cwd: repository, arguments: ["config", "user.name", "sample"] });
  await git({
    cwd: repository,
    arguments: ["config", "user.email", "11+sample@users.noreply.github.com"],
  });
  await git({
    cwd: repository,
    arguments: ["commit", "--quiet", "--allow-empty", "-m", "chore: start"],
  });
  await git({ cwd: repository, arguments: ["push", "--quiet", "origin", "HEAD:refs/heads/main"] });

  return repository;
}

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-hooks-"));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("session git hooks", () => {
  test("the pre-push hook refuses the default branch and allows the session branch", async () => {
    const repository = await repositoryWithOrigin("push");

    await hook({ repository, name: "pre-push", content: prePushHook("main") });
    await git({
      cwd: repository,
      arguments: ["commit", "--quiet", "--allow-empty", "-m", "feat: work"],
    });

    const toMain = await git({
      cwd: repository,
      arguments: ["push", "origin", "HEAD:refs/heads/main"],
    });
    const toBranch = await git({
      cwd: repository,
      arguments: ["push", "--quiet", "origin", "HEAD:refs/heads/shadowclone/issue-12"],
    });

    expect(toMain.exitCode).not.toBe(0);
    expect(toMain.stderr).toContain("a session never pushes to main");
    expect(toBranch.exitCode).toBe(0);
  });

  test("the commit-msg hook adds the agent trailer once", async () => {
    const repository = await repositoryWithOrigin("trailer");

    await hook({
      repository,
      name: "commit-msg",
      content: commitMessageHook("Claude <noreply@anthropic.com>"),
    });
    await git({
      cwd: repository,
      arguments: [
        "commit",
        "--quiet",
        "--allow-empty",
        "-m",
        "fix: parse dates\n\nCo-authored-by: Claude <noreply@anthropic.com>",
      ],
    });
    await git({
      cwd: repository,
      arguments: ["commit", "--quiet", "--allow-empty", "-m", "fix: parse times"],
    });

    const log = await git({ cwd: repository, arguments: ["log", "-2", "--format=%B%x00"] });
    const [latest = "", previous = ""] = log.stdout.split("\0").map((message) => message.trim());

    expect(latest.match(/Co-authored-by: Claude <noreply@anthropic.com>/g)).toHaveLength(1);
    expect(previous.match(/Co-authored-by: Claude <noreply@anthropic.com>/g)).toHaveLength(1);
  });
});
