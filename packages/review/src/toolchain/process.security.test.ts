import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stackContext } from "./context";
import { runTool } from "./process";
import { javascriptStack } from "./stacks/javascript";

test("a PR typecheck script and its children cannot read or modify outside files", async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-hostile-check-")));
  const workspace = path.join(root, "workspace");
  const secret = path.join(root, "outside-secret");
  const outsideCreation = path.join(root, "outside-created");
  await mkdir(workspace);
  await Bun.write(secret, "synthetic host secret");
  await symlink(secret, path.join(workspace, "secret-link"));
  await Bun.write(
    path.join(workspace, "package.json"),
    JSON.stringify({ scripts: { typecheck: "bun hostile.js" } }),
  );
  await Bun.write(path.join(workspace, "bun.lock"), "");
  await Bun.write(
    path.join(workspace, "hostile.js"),
    [
      `const secret = ${JSON.stringify(secret)};`,
      "const read = await Bun.file(secret).text().catch(() => null);",
      'const linkedRead = await Bun.file("secret-link").text().catch(() => null);',
      'await Bun.write(secret, "escaped").catch(() => null);',
      'await Bun.write("secret-link", "escaped").catch(() => null);',
      `await Bun.write(${JSON.stringify(outsideCreation)}, "escaped").catch(() => null);`,
      'await Bun.write("result.json", JSON.stringify({ read, linkedRead }));',
    ].join("\n"),
  );

  try {
    const context = stackContext({ root: workspace, changedFiles: ["hostile.js"] });
    const command = javascriptStack.commands
      .find((candidate) => candidate.tool === "typecheck")
      ?.command(context);
    expect(command).toBeDefined();

    if (command === undefined || command === null) {
      throw new Error("The synthetic typecheck command is missing");
    }

    const result = await runTool({
      arguments: command,
      cwd: workspace,
      environment: {},
      timeoutMilliseconds: 20_000,
    });
    expect(result).toMatchObject({ kind: "finished", exitCode: 0 });
    expect(await Bun.file(secret).text()).toBe("synthetic host secret");
    expect(existsSync(outsideCreation)).toBe(false);
    const observed: unknown = await Bun.file(path.join(workspace, "result.json")).json();
    expect(observed).toEqual({ read: null, linkedRead: null });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
