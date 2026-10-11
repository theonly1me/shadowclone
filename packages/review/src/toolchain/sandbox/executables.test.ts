import { expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runTool } from "../process";

test("a tool invoked through a symlink keeps its command name and follows its runtime links", async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-dispatcher-")));
  const workspace = path.join(root, "work");
  const bin = path.join(root, "bin");
  const links = path.join(root, "links");
  const runtime = path.join(root, "runtime");
  for (const directory of [workspace, bin, links, runtime]) {
    await mkdir(directory);
  }
  const executable = path.join(runtime, "rustup");
  await Bun.write(
    executable,
    '#!/bin/sh\ncase "$0" in */cargo) printf "cargo:%s\\n" "$1";; *) exit 23;; esac\n',
  );
  await chmod(executable, 0o755);
  await symlink("../runtime/rustup", path.join(links, "cargo"));
  await symlink("../links/cargo", path.join(bin, "cargo"));

  try {
    const result = await runTool({
      arguments: ["cargo", "clippy"],
      cwd: workspace,
      environment: { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}` },
      timeoutMilliseconds: 10_000,
    });
    expect(result).toMatchObject({ kind: "finished", exitCode: 0, output: "cargo:clippy\n\n" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

for (const tool of ["mvn", "gradle"]) {
  test(`${tool} can read standalone runtime files without reading global credentials`, async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-java-runtime-")));
    const workspace = path.join(root, "work");
    const runtime = path.join(root, "installation");
    const bin = path.join(runtime, "bin");
    await mkdir(workspace);
    for (const directory of ["bin", "boot", "lib", "conf/logging"]) {
      await mkdir(path.join(runtime, directory), { recursive: true });
    }
    await Bun.write(path.join(runtime, "lib/runtime.txt"), "synthetic runtime\n");
    await Bun.write(path.join(runtime, "conf/settings.xml"), "synthetic host credentials");
    const executable = path.join(bin, tool);
    await Bun.write(
      executable,
      [
        "#!/bin/sh",
        'runtime=$(cd "$(dirname "$0")/.." && pwd)',
        'cat "$runtime/lib/runtime.txt" || exit 24',
        'if cat "$runtime/conf/settings.xml" >/dev/null 2>&1; then exit 23; fi',
      ].join("\n"),
    );
    await chmod(executable, 0o755);

    try {
      const result = await runTool({
        arguments: [tool, "--version"],
        cwd: workspace,
        environment: { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}` },
        timeoutMilliseconds: 10_000,
      });
      expect(result).toMatchObject({
        kind: "finished",
        exitCode: 0,
        output: "synthetic runtime\n\n",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
