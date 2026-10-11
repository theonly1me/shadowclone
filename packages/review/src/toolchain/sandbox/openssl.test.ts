import { expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runTool } from "../process";

test("Node starts without reading a host OpenSSL configuration", async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-openssl-")));
  const workspace = path.join(root, "work");
  await mkdir(workspace);
  const configuration = path.join(root, "openssl.cnf");
  await Bun.write(configuration, "synthetic host configuration");

  try {
    const result = await runTool({
      arguments: ["node", "-e", 'console.log("node-started:" + process.env.OPENSSL_CONF)'],
      cwd: workspace,
      environment: { OPENSSL_CONF: configuration },
      timeoutMilliseconds: 10_000,
    });
    expect(result).toMatchObject({
      kind: "finished",
      exitCode: 0,
      output: "node-started:/dev/null\n\n",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
