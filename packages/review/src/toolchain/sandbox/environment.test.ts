import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runTool } from "../process";

test("sandbox setup cannot restore filtered host credentials through Java or Git configuration", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "shadowclone-sandbox-env-"));
  const sensitive = {
    SYNTHETIC_HOST_SECRET: "synthetic-secret",
    JAVA_TOOL_OPTIONS: "-Dsynthetic.secret=synthetic-secret",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.extraheader",
    GIT_CONFIG_VALUE_0: "Authorization: synthetic-secret",
  };
  const previous = Object.keys(sensitive).map((name) => ({ name, value: process.env[name] }));
  Object.assign(process.env, sensitive);

  try {
    const result = await runTool({
      arguments: [
        "bun",
        "-e",
        'console.log(JSON.stringify(Object.values(process.env).filter(value => value?.includes("synthetic-secret"))))',
      ],
      cwd,
      environment: {},
      timeoutMilliseconds: 10_000,
    });
    expect(result).toMatchObject({ kind: "finished", exitCode: 0 });
    if (result.kind !== "finished") {
      throw new Error("The synthetic environment probe did not finish");
    }
    expect(JSON.parse(result.output)).toEqual([]);
  } finally {
    for (const { name, value } of previous) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    await rm(cwd, { recursive: true, force: true });
  }
});
