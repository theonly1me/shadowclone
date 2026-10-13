import path from "node:path";
import type { Integration } from "./types";

export function renderOpencodePlugin(integration: Integration): string {
  const launcher = path.join(integration.userDirectory, ".shadowclone", "bin", "shadowclone");

  return `import { spawn } from "node:child_process";

const launcher = ${JSON.stringify(launcher)};
const integrationId = ${JSON.stringify(integration.id)};
const disabled = process.env.SHADOWCLONE_INTERNAL_RUN === "1";
const contexts = new Map();
const active = new Set();

const invoke = ({ event, input }) => new Promise(resolve => {
  const child = spawn("sh", [launcher, "hook", event, integrationId], {
    stdio: ["pipe", "pipe", "ignore"], timeout: event === "native-end" ? 30000 : 10000,
  });
  let output = "";
  child.stdout.on("data", chunk => {
    if (output.length + chunk.length > 65536) child.kill();
    else output += chunk.toString();
  });
  child.on("error", () => resolve(""));
  child.on("close", () => resolve(output));
  child.stdin.on("error", () => {});
  child.stdin.end(JSON.stringify(input));
});

const sessionInput = ({ sessionID, directory }) =>
  ({ cwd: directory, session_id: sessionID, timestamp: Date.now() });

const sessionContext = ({ sessionID, directory }) => {
  if (!sessionID) return Promise.resolve("");
  if (!contexts.has(sessionID)) {
    contexts.set(sessionID, invoke({ event: "native-start", input: sessionInput({ sessionID, directory }) })
      .then(output => {
        try { return JSON.parse(output).additionalContext || ""; }
        catch { return ""; }
      }));
  }
  active.add(sessionID);
  return contexts.get(sessionID);
};

const idleSessionId = event => {
  const data = event?.properties ?? event?.data;
  const idle = event?.type === "session.idle" ||
    (event?.type === "session.status" && data?.status?.type === "idle");
  return idle ? data?.sessionID : undefined;
};

const sessionEnd = ({ event, directory }) => {
  const sessionID = idleSessionId(event);
  if (!sessionID || !active.delete(sessionID)) return Promise.resolve();
  return invoke({ event: "native-end", input: sessionInput({ sessionID, directory }) });
};

export default {
  id: "shadowclone",
  async server(input) {
    if (disabled) return {};
    return {
      "experimental.chat.system.transform": async (request, output) => {
        const context = await sessionContext({ sessionID: request.sessionID, directory: input.directory });
        if (context) output.system.push(context);
      },
      event: async ({ event }) => {
        await sessionEnd({ event, directory: input.directory });
      },
    };
  },
  async setup(ctx) {
    if (disabled) return;
    const directory = ctx.location.directory;
    await ctx.session.hook("context", async request => {
      const context = await sessionContext({ sessionID: request.sessionID, directory });
      if (context) request.system.push({ type: "text", text: context });
    });
    const controller = new AbortController();
    (async () => {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        await sessionEnd({ event, directory });
      }
    })().catch(() => {});
    return () => controller.abort();
  },
};
`;
}
