import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runProcess } from "../io/process";
import { dispatchCommand } from "./dispatchIsolation";

test("dispatch confines writes and hides source and control files", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-dispatch-test-"),
  );
  try {
    const repository = path.join(root, "source");
    const state = path.join(root, "state");
    const directory = path.join(state, "worktrees", "task");
    const profile = path.join(state, "runs", "profile.md");
    await mkdir(path.join(repository, ".git"), { recursive: true });
    await mkdir(directory, { recursive: true });
    await mkdir(path.dirname(profile), { recursive: true });
    await writeFile(profile, "compiled-guidance");
    await writeFile(path.join(directory, ".git"), "immutable-metadata");
    await writeFile(path.join(repository, "secret"), "source-sentinel");
    await writeFile(path.join(state, "config"), "control-sentinel");
    const execute = (arguments_: readonly string[]) =>
      runProcess({
        arguments: dispatchCommand({
          arguments: arguments_,
          platform: process.platform,
          run: {
            prompt: "",
            cwd: directory,
            systemPromptFile: profile,
            execution: {
              purpose: "dispatch",
              blockedPaths: [repository, state],
              repositoryDirectory: repository,
            },
          },
        }),
        cwd: directory,
        environment: { PATH: process.env.PATH },
        timeoutMilliseconds: 5000,
      });
    const probe = await execute(["/usr/bin/true"]).catch(() => null);
    if (probe === null || probe.exitCode !== 0) {
      if (process.env.CI) {
        throw new Error("Required dispatch sandbox is unavailable in CI");
      }
      console.log(
        "Dispatch sandbox unavailable inside the current host sandbox; run the targeted check outside it.",
      );
      return;
    }
    expect((await execute(["/bin/cat", profile])).stdout).toBe(
      "compiled-guidance",
    );
    const result = await execute([
      "/bin/sh",
      "-c",
      'echo allowed > change; cat "$1" > stolen; cat "$2" >> stolen; echo modified > .git; echo escaped > "$3"',
      "fixture",
      path.join(repository, "secret"),
      path.join(state, "config"),
      path.join(root, "outside"),
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(await Bun.file(path.join(directory, "change")).text()).toBe(
      "allowed\n",
    );
    expect(await Bun.file(path.join(directory, ".git")).text()).toBe(
      "immutable-metadata",
    );
    expect(await Bun.file(path.join(directory, "stolen")).text()).toBe("");
    expect(await Bun.file(path.join(root, "outside")).exists()).toBeFalse();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
