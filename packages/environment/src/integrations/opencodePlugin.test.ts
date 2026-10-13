import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { renderOpencodePlugin } from "./opencodePlugin";

const driver = `import plugin from "./plugin.js";
const versionOne = await plugin.server({ directory: "/work/one" });
const transform = versionOne["experimental.chat.system.transform"];
const first = { system: [] };
const second = { system: [] };
await transform({ sessionID: "ses_one", model: {} }, first);
await transform({ sessionID: "ses_one", model: {} }, second);
await versionOne.event({ event: { type: "session.idle", properties: { sessionID: "ses_one" } } });
await versionOne.event({ event: { type: "session.idle", properties: { sessionID: "ses_one" } } });
let contextHook;
let opened;
let drained;
const gate = new Promise(resolve => { opened = resolve; });
const done = new Promise(resolve => { drained = resolve; });
const stop = await plugin.setup({
  location: { directory: "/work/two" },
  session: { hook: async (name, callback) => { if (name === "context") contextHook = callback; } },
  event: {
    subscribe: () => (async function* () {
      await gate;
      yield { type: "session.status", data: { sessionID: "ses_two", status: { type: "idle" } } };
      drained();
    })(),
  },
});
const request = { sessionID: "ses_two", system: [] };
await contextHook(request);
opened();
await done;
stop();
console.log(JSON.stringify({ first: first.system, second: second.system, versionTwo: request.system }));
`;

const callSchema = z.object({ cwd: z.string(), session_id: z.string() });

test("the OpenCode plugin adds session context before model calls and ends each busy session once", async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), "shadowclone-opencode-plugin-"));
  const log = path.join(home, "calls.log");

  try {
    await Bun.write(
      path.join(home, ".shadowclone/bin/shadowclone"),
      `input=$(cat)\nprintf '%s %s\\n' "$2" "$input" >> ${JSON.stringify(log)}\n` +
        `if [ "$2" = native-start ]; then printf '{"additionalContext":"Use complete names."}'; fi\n`,
    );
    await Bun.write(
      path.join(home, "plugin.js"),
      renderOpencodePlugin({
        id: "11111111-1111-4111-8111-111111111111",
        agent: "opencode",
        scope: "global",
        directory: home,
        userDirectory: home,
        codexInstructions: "AGENTS.md",
        files: [],
        excludes: [],
        deliveredAt: null,
      }),
    );
    await Bun.write(path.join(home, "driver.mjs"), driver);

    const run = Bun.spawn([process.execPath, "driver.mjs"], {
      cwd: home,
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(run.stdout).text();

    expect(await run.exited).toBe(0);
    expect(JSON.parse(output)).toEqual({
      first: ["Use complete names."],
      second: ["Use complete names."],
      versionTwo: [{ type: "text", text: "Use complete names." }],
    });

    const calls = (await Bun.file(log).text())
      .trim()
      .split("\n")
      .map((line) => {
        const [event = "", ...input] = line.split(" ");
        const call = callSchema.parse(JSON.parse(input.join(" ")));

        return `${event} ${call.session_id} ${call.cwd}`;
      });

    expect(calls).toEqual([
      "native-start ses_one /work/one",
      "native-end ses_one /work/one",
      "native-start ses_two /work/two",
      "native-end ses_two /work/two",
    ]);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
