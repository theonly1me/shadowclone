import { mkdtemp, readdir, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { runProcess } from "../../../io/process";
import { parseClaudeStream } from "../../../engine/parseClaude";
import { contractSandbox } from "../claudeContract/sandbox";
import { syntheticNativePacket } from "./nativePacket";
import { nativeDeliveryObservation } from "./nativeObservation";
import { nativeExchange } from "./nativeExchange";
import { nativeProof } from "./nativeProof";

export async function probeNativeDelivery(options: { mode: "hook" | "memory" | "prompt"; bytes: number; packet?: string; scripted?: boolean }) {
  const location = Bun.which("claude");
  if (!location) throw new Error("Claude CLI is unavailable for native delivery preflight");
  const executable = await realpath(location);
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-native-contract-")));
  const packet = options.packet ?? syntheticNativePacket(options.bytes);
  const forbidden = "SHADOWCLONE_UNSELECTED_CONFIGURATION_CANARY";
  const observations: Awaited<ReturnType<typeof nativeDeliveryObservation>>[] = [];
  const maximumMessages = options.scripted ? 5 : 1;
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => {
    if (new URL(request.url).pathname !== "/v1/messages") return Response.json({}, { status: 404 });
    const body: unknown = await request.json();
    observations.push(await nativeDeliveryObservation({ body, packet, forbidden, directory }));
    if (observations.length > maximumMessages) return Response.json({ error: { type: "invalid_request_error", message: "Synthetic native exchange limit" } }, { status: 400 });
    const parsed = z.object({ stream: z.boolean().optional() }).parse(body);
    return nativeExchange({ directory, request: observations.length, stream: parsed.stream === true, scripted: options.scripted === true });
  } });
  try {
    const configuration = path.join(directory, "configuration");
    const memory = path.join(directory, "memory");
    const hook = path.join(directory, "hook.json");
    await Bun.write(path.join(configuration, "CLAUDE.md"), forbidden);
    await Bun.write(path.join(memory, "MEMORY.md"), packet);
    await Bun.write(path.join(directory, "references/fixture.md"), "Synthetic reference content for successful retrieval.\n");
    await Bun.write(hook, JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: packet } }));
    const protectedPaths = ["memory/MEMORY.md", "references/fixture.md", "hook.json", "configuration/CLAUDE.md"];
    const fingerprints = async () => Promise.all(protectedPaths.map(async relativePath => ({ relativePath,
      fingerprint: new Bun.CryptoHasher("sha256").update(await Bun.file(path.join(directory, relativePath)).arrayBuffer()).digest("hex") })));
    const before = await fingerprints();
    const settings = { autoMemoryEnabled: options.mode === "memory", autoMemoryDirectory: memory,
      disableAllHooks: options.mode !== "hook", permissions: { allow: options.scripted ? ["Read", "Write", "Edit", "Bash", "Glob", "Grep"] : [] }, hooks: options.mode === "hook"
        ? { SessionStart: [{ hooks: [{ type: "command", command: `/bin/cat ${JSON.stringify(hook)}`, timeout: 10 }] }] } : {} };
    const result = await runProcess({
      arguments: contractSandbox({ executable, directory, port: server.port ?? 0, readOnlyPaths: [memory, path.join(directory, "references"), hook, path.join(configuration, "CLAUDE.md")], arguments: [
        "--print", "--verbose", "--output-format", "stream-json", "--no-session-persistence",
        "--setting-sources", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
        "--tools", options.scripted ? "Read,Write,Edit,Bash,Glob,Grep" : "", "--permission-mode", "dontAsk", "--settings", JSON.stringify(settings),
        "--model", "claude-sonnet-5", "--effort", "medium", "--max-budget-usd", "0.05",
      ] }), cwd: directory,
      environment: { PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin", CLAUDE_CONFIG_DIR: configuration,
        ANTHROPIC_BASE_URL: server.url.origin, ANTHROPIC_API_KEY: "shadowclone-local-contract-fixture", CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1", TMPDIR: directory, CI: "1" },
      input: [options.mode === "prompt" ? packet : "", "Complete the scripted synthetic contract inside the fixture only."].filter(Boolean).join("\n\n"), timeoutMilliseconds: 45000, maximumOutputBytes: 262144,
    });
    const parsed = parseClaudeStream({ stream: result.stdout, fallbackSessionId: "synthetic" });
    const actions = parsed.actions.map(({ tool, path: filePath, succeeded, requestSequence, resultSequence }) => ({ tool, path: filePath?.startsWith(`${directory}${path.sep}`) ? path.relative(directory, filePath) : null, succeeded, requestSequence, resultSequence }));
    const after = await fingerprints();
    const memoryFiles = (await readdir(memory)).sort();
    const proof = nativeProof({ exitCode: result.exitCode, isError: parsed.isError, scripted: options.scripted === true, observations, actions, before, after, memoryFiles });
    return { mode: options.mode, bytes: Buffer.byteLength(packet), characters: packet.length, packetFingerprint: new Bun.CryptoHasher("sha256").update(packet).digest("hex"), messages: observations.length, exitCode: result.exitCode,
      observations, ...proof, actions, protectedFiles: { before, after, memoryFiles },
      deliverySettings: { autoMemoryEnabled: settings.autoMemoryEnabled, hookEnabled: !settings.disableAllHooks, toolsEnabled: options.scripted === true },
    };
  } finally { await server.stop(true); await rm(directory, { recursive: true, force: true }); }
}
