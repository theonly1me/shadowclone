import path from "node:path";
import { mkdir } from "node:fs/promises";
import { runProcess } from "../../../io/process";
import { redactSecrets } from "../../../redact";
import { contractSandbox } from "./sandbox";

export async function probeClaudeSchema(options: {
  readonly executable: string;
  readonly directory: string;
  readonly schema: unknown;
}): Promise<{ readonly messages: number; readonly exitCode: number; readonly failure: string }> {
  let messages = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => {
      if (new URL(request.url).pathname === "/v1/messages") messages += 1;
      return Response.json({ type: "error", error: { type: "invalid_request_error", message: "Shadowclone local schema contract complete" } }, { status: 400 });
    },
  });
  try {
    const configuration = path.join(options.directory, "configuration");
    await mkdir(configuration, { recursive: true, mode: 0o700 });
    const argumentsList = [
      "--bare", "--safe-mode", "--print", "--verbose", "--output-format", "stream-json",
      "--no-session-persistence", "--setting-sources", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
      "--tools", "", "--model", "claude-sonnet-5", "--effort", "medium", "--max-budget-usd", "0.01",
      "--json-schema", JSON.stringify(options.schema),
    ];
    const result = await runProcess({
      arguments: contractSandbox({ executable: options.executable, arguments: argumentsList, directory: options.directory, port: server.port ?? 0 }),
      cwd: options.directory,
      environment: {
        PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
        CLAUDE_CONFIG_DIR: configuration,
        ANTHROPIC_BASE_URL: server.url.origin,
        ANTHROPIC_API_KEY: "shadowclone-local-contract-fixture",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        TMPDIR: options.directory,
        CI: "1",
      },
      input: "Return an empty checks array. This is a synthetic local schema contract test.",
      timeoutMilliseconds: 30000,
      maximumOutputBytes: 65536,
    });
    return { messages, exitCode: result.exitCode, failure: redactSecrets({ text: result.stderr.trim() }) };
  } finally { await server.stop(true); }
}
