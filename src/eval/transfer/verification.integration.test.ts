import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runProcess } from "../../io/process";
import { verificationArguments } from "./verify";

test("verification enforces host write and credential read restrictions", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "shadowclone-sandbox-test-"),
  );
  try {
    const directory = path.join(root, "workspace");
    const temporaryDirectory = path.join(root, "temporary");
    const homeDirectory = path.join(root, "home");
    await mkdir(directory);
    await mkdir(temporaryDirectory);
    await mkdir(path.join(homeDirectory, ".ssh"), { recursive: true });
    const credential = path.join(homeDirectory, ".ssh", "sentinel");
    const outside = path.join(root, "outside");
    const control = path.join(root, "control");
    await mkdir(control);
    await writeFile(path.join(control, "judge"), "protected-evidence");
    await writeFile(credential, "private-fixture");
    const execute = (arguments_: readonly string[]) =>
      runProcess({
        arguments: verificationArguments({
          directory,
          temporaryDirectory,
          homeDirectory,
          blockedPaths: [control],
          arguments: arguments_,
          platform: process.platform,
        }),
        cwd: directory,
        environment: {
          PATH: process.env.PATH,
          HOME: temporaryDirectory,
          TMPDIR: temporaryDirectory,
        },
        timeoutMilliseconds: 5000,
      });
    const probe = await execute(["/usr/bin/true"]).catch(() => null);
    if (probe === null || probe.exitCode !== 0) {
      if (process.env.CI) {
        throw new Error(`Required verification sandbox is unavailable in CI: ${probe?.stderr.trim() || "process did not start"}`);
      }
      console.log(
        "Sandbox integration unavailable inside the current host sandbox; run the targeted check outside it.",
      );
      return;
    }
    const runtime = await execute([
      process.execPath,
      "-e",
      'process.stdout.write("runtime-ok")',
    ]);
    expect(runtime.exitCode).toBe(0);
    expect(runtime.stdout).toBe("runtime-ok");
    const result = await execute([
      "/bin/sh",
      "-c",
      'echo allowed > allowed; cat "$1" > stolen; echo escaped > "$2"',
      "fixture",
      credential,
      outside,
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(await Bun.file(path.join(directory, "allowed")).text()).toBe(
      "allowed\n",
    );
    expect(await Bun.file(outside).exists()).toBeFalse();
    expect(await Bun.file(path.join(directory, "stolen")).text()).toBe("");
    const controlRead = await execute([
      "/bin/cat",
      path.join(control, "judge"),
    ]);
    expect(controlRead.exitCode).not.toBe(0);
    expect(controlRead.stdout).toBe("");
    const listener = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: () => new Response("network-escaped"),
    });
    try {
      const network = await execute([
        process.execPath,
        "-e",
        `fetch("http://127.0.0.1:${listener.port}").then(() => process.exit(42)).catch(() => process.exit(0))`,
      ]);
      expect(network.exitCode).toBe(0);
    } finally {
      await listener.stop(true);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
