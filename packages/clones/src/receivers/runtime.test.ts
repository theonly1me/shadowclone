import { expect, test } from "bun:test";
import { sampleConfig } from "../fixtures";
import { receiverRuntime } from "./runtime";

test("the receiver forwards only the named secrets, the config, and the event to the sandbox", () => {
  const config = JSON.stringify(sampleConfig({ host: "cloudflare" }));
  const runtime = receiverRuntime({
    SHADOWCLONE_SESSION_CONFIG: config,
    SHADOWCLONE_WEBHOOK_SECRET: "synthetic-webhook-secret",
    SHADOWCLONE_FORWARD: "GH_TOKEN,CLAUDE_CODE_OAUTH_TOKEN,OLLAMA_API_KEY",
    GH_TOKEN: "synthetic-github-token",
    CLAUDE_CODE_OAUTH_TOKEN: "synthetic-claude-token",
    OLLAMA_API_KEY: "",
    DAYTONA_API_KEY: "synthetic-host-key",
  });

  expect(runtime.settings).toEqual({
    webhookSecret: "synthetic-webhook-secret",
    ownerId: 11,
    repositoryId: 7,
    reviewerBots: ["coderabbitai[bot]", "github-actions[bot]"],
  });
  expect(runtime.sandboxEnvironment({ kind: "ci", runId: 900 })).toEqual({
    GH_TOKEN: "synthetic-github-token",
    CLAUDE_CODE_OAUTH_TOKEN: "synthetic-claude-token",
    SHADOWCLONE_SESSION_CONFIG: config,
    SHADOWCLONE_SESSION_EVENT: '{"kind":"ci","runId":900}',
    IS_SANDBOX: "1",
  });
});
