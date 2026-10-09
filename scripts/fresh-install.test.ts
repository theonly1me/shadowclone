import { expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildRuntimeArtifacts } from "./bundle";

test("a relocated package initializes a fresh home and hooks work without shadowclone on PATH", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "shadowclone-fresh-package-"));
  const packageDirectory = path.join(root, "package");
  const userDirectory = path.join(root, "user");
  const repository = path.join(root, "repository");
  const output = path.join(packageDirectory, "dist/shadowclone.js");
  await mkdir(repository, { recursive: true });
  try {
    for (const name of ["package.json", "preferences", "skills"]) {
      await cp(path.resolve(name), path.join(packageDirectory, name), { recursive: true });
    }
    const artifacts = await buildRuntimeArtifacts(path.resolve("packages/cli/src/main.ts"));
    for (const [index, artifact] of artifacts.entries()) {
      const relativePath = path.relative(process.cwd(), artifact.path);
      if (relativePath.startsWith("..")) throw new Error("Unexpected build output");
      await Bun.write(index === 0 ? output : path.join(packageDirectory, "dist", relativePath), artifact);
    }
    const environment = {
      ...process.env, HOME: userDirectory, CODEX_HOME: path.join(userDirectory, ".codex"),
      CLAUDE_CONFIG_DIR: path.join(userDirectory, ".claude"),
      PI_CODING_AGENT_DIR: path.join(userDirectory, ".pi/agent"),
      SHADOWCLONE_INTERNAL_RUN: "1",
    };
    const command = async (arguments_: readonly string[]) => {
      const child = Bun.spawn([process.execPath, output, ...arguments_], {
        cwd: repository, env: environment, stdout: "pipe", stderr: "pipe",
      });
      const [text, error, exitCode] = await Promise.all([
        new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
      ]);
      expect(error).toBe("");
      expect(exitCode).toBe(0);
      return text;
    };
    expect(await command(["init", "--no-learn", "--skill-maintenance", "--no-background-learning"])).toContain("0 rules learned");
    for (const agent of ["claude-code", "codex", "pi"]) {
      await command(["install", "--agent", agent, "--global"]);
    }
    expect(await command(["init", "--status", "--json"])).toContain('"initialized":true');
    expect(JSON.parse(await command(["learning", "pending"]))).toEqual([]);
    expect(await Bun.file(path.join(repository, "AGENTS.md")).exists()).toBeFalse();
    expect(await Bun.file(path.join(repository, "CLAUDE.md")).exists()).toBeFalse();
    expect(await Bun.file(path.join(userDirectory, ".pi/agent/extensions/shadowclone.js")).text()).toContain("agent_settled");
    const launcher = path.join(userDirectory, ".shadowclone/bin/shadowclone");
    const hook = Bun.spawn(["/bin/sh", launcher, "--version"], {
      cwd: repository, env: { ...environment, PATH: "/usr/bin:/bin" }, stdout: "pipe", stderr: "pipe",
    });
    expect((await new Response(hook.stdout).text()).trim()).toBe((await Bun.file("package.json").json()).version);
    expect(await hook.exited).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
