import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { parseClaudeStream } from "../../../engine/parseClaude";
import { runProcess } from "../../../io/process";
import { redactSecrets } from "../../../redact";
import { deliveryTrace } from "../trace";
import { contractSandbox } from "./sandbox";
import { mockMessage } from "./mockMessages";

export async function verifyClaudeStreamContract() {
  const location = Bun.which("claude");

  if (!location) {
    throw new Error("Claude CLI is unavailable for stream contract");
  }

  const executable = await realpath(location);
  const directory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "shadowclone-stream-contract-")),
  );
  let messages = 0;

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      if (new URL(request.url).pathname !== "/v1/messages") {
        return Response.json({}, { status: 404 });
      }

      messages += 1;

      if (messages > 4) {
        return Response.json(
          {
            error: {
              type: "invalid_request_error",
              message: "Synthetic exchange limit",
            },
          },
          { status: 400 },
        );
      }

      const body = z
        .object({ stream: z.boolean().optional() })
        .parse(await request.json());

      return mockMessage({
        directory,
        request: messages,
        stream: body.stream === true,
      });
    },
  });

  try {
    await Bun.write(
      path.join(directory, "skills/clean-code/SKILL.md"),
      "Synthetic skill. Use complete names.\n",
    );

    const result = await runProcess({
      arguments: contractSandbox({
        executable,
        directory,
        port: server.port ?? 0,
        arguments: [
          "--safe-mode",
          "--print",
          "--verbose",
          "--output-format",
          "stream-json",
          "--no-session-persistence",
          "--setting-sources",
          "",
          "--strict-mcp-config",
          "--mcp-config",
          '{"mcpServers":{}}',
          "--tools",
          "Read,Write",
          "--allowedTools",
          "Read",
          "Write",
          "--permission-mode",
          "dontAsk",
          "--settings",
          JSON.stringify({
            disableAllHooks: true,
            autoMemoryEnabled: false,
            permissions: { allow: ["Read", "Write"] },
          }),
          "--model",
          "claude-sonnet-5",
          "--effort",
          "medium",
          "--max-budget-usd",
          "0.05",
        ],
      }),
      cwd: directory,
      environment: {
        PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
        CLAUDE_CONFIG_DIR: path.join(directory, "configuration"),
        ANTHROPIC_BASE_URL: server.url.origin,
        ANTHROPIC_API_KEY: "shadowclone-local-contract-fixture",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        TMPDIR: directory,
        CI: "1",
      },
      input:
        "Perform the synthetic local tool exchange. No personal context or external requests are needed.",
      timeoutMilliseconds: 45000,
      maximumOutputBytes: 262144,
    });

    const parsed = parseClaudeStream({
      stream: result.stdout,
      fallbackSessionId: "synthetic",
    });
    const trace = deliveryTrace({
      directory,
      actions: parsed.actions,
      scenario: { expectedSkills: ["clean-code"], expectedReferences: [] },
    });

    if (
      result.exitCode !== 0 ||
      parsed.isError ||
      messages !== 4 ||
      trace.reads.length !== 2 ||
      trace.reads[0]?.beforeEdit !== true ||
      trace.reads[1]?.beforeEdit !== false ||
      !trace.actions.some(
        (action) => action.tool === "Read" && action.succeeded === false,
      ) ||
      !trace.actions.some((action) => action.effect === "mutation")
    ) {
      throw new Error(
        `Claude stream contract failed: ${JSON.stringify({ messages, exitCode: result.exitCode, actions: trace.actions, denials: parsed.permissionDenials, failure: redactSecrets({ text: result.stderr }) })}`,
      );
    }

    return {
      checkedAt: Date.now(),
      network: "loopback-only",
      messages,
      resolvedModel: parsed.resolvedModel,
      trace,
    };
  } finally {
    await server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
}

export type ClaudeStreamProof = Awaited<
  ReturnType<typeof verifyClaudeStreamContract>
>;
