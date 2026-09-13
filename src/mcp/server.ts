import packageManifest from "../../package.json";
import { preferenceTools, runPreferenceTool } from "./preferences";
import { compileContext } from "../integrations";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import type { GitRemoteReader } from "../signal";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  readonly id: JsonRpcId;
  readonly method: string;
  readonly params: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequest(value: unknown): JsonRpcRequest | null {
  if (!isRecord(value) || typeof value.method !== "string") {
    return null;
  }
  const id =
    typeof value.id === "string" || typeof value.id === "number"
      ? value.id
      : null;
  return { id, method: value.method, params: value.params };
}

export function handleMcpRequest(options: {
  readonly request: JsonRpcRequest;
  readonly profile: string;
  readonly toolResult?: Readonly<Record<string, unknown>> | null;
}): Readonly<Record<string, unknown>> | null {
  const base = { jsonrpc: "2.0", id: options.request.id };
  if (options.request.method === "initialize") {
    return {
      ...base,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "shadowclone", version: packageManifest.version },
      },
    };
  }
  if (options.request.method === "tools/list") {
    return {
      ...base,
      result: {
        tools: [
          ...preferenceTools,
          {
            name: "shadowclone_profile",
            description:
              "Load the active user's engineering profile for this repository",
            inputSchema: { type: "object", properties: {} },
          },
        ],
      },
    };
  }
  if (options.request.method === "tools/call") {
    if (options.toolResult) return { ...base, result: options.toolResult };
    const params = isRecord(options.request.params)
      ? options.request.params
      : {};
    if (params.name !== "shadowclone_profile") {
      return {
        ...base,
        error: { code: -32602, message: "Unknown tool" },
      };
    }
    return {
      ...base,
      result: {
        content: [{ type: "text", text: options.profile }],
        isError: false,
      },
    };
  }
  if (options.request.method.startsWith("notifications/")) {
    return null;
  }
  return {
    ...base,
    error: { code: -32601, message: "Method not found" },
  };
}

async function activeProfile(options: {
  readonly cwd: string;
  readonly configPath?: string;
  readonly paths: ProjectPaths;
  readonly readRemote?: GitRemoteReader;
  readonly managedConfigPath?: string | null;
}): Promise<string> {
  return await compileContext(options) ?? "# Shadowclone profile\n";
}

async function writeMessage(value: Readonly<Record<string, unknown>>): Promise<void> {
  await Bun.stdout.write(`${JSON.stringify(value)}\n`);
}

export async function serveMcp(options: {
  readonly cwd?: string;
  readonly configPath?: string;
  readonly paths?: ProjectPaths;
  readonly readRemote?: GitRemoteReader;
  readonly managedConfigPath?: string | null;
} = {}): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const paths = options.paths ?? projectPaths;
  let buffer = "";
  const decoder = new TextDecoder();

  for await (const chunk of Bun.stdin.stream()) {
    buffer += decoder.decode(chunk, { stream: true });
    let lineEnd = buffer.indexOf("\n");
    while (lineEnd >= 0) {
      const line = buffer.slice(0, lineEnd).trim();
      buffer = buffer.slice(lineEnd + 1);
      if (line.length > 0) {
        try {
          const request = parseRequest(JSON.parse(line));
          if (request === null) {
            await writeMessage({
              jsonrpc: "2.0",
              id: null,
              error: { code: -32600, message: "Invalid request" },
            });
          } else {
            const profile =
              request.method === "tools/call" &&
              isRecord(request.params) &&
              request.params.name === "shadowclone_profile"
                ? await activeProfile({
                    cwd,
                    configPath: options.configPath,
                    paths,
                    readRemote: options.readRemote,
                    managedConfigPath: options.managedConfigPath,
                  })
                : "";
            const toolResult = request.method === "tools/call"
              ? await runPreferenceTool({ params: request.params, cwd, paths, managedConfigPath: options.managedConfigPath, readRemote: options.readRemote })
              : null;
            const response = handleMcpRequest({ request, profile, toolResult });
            if (response !== null) {
              await writeMessage(response);
            }
          }
        } catch {
          await writeMessage({
            jsonrpc: "2.0",
            id: null,
            error: { code: -32700, message: "Parse error" },
          });
        }
      }
      lineEnd = buffer.indexOf("\n");
    }
  }
}

if (import.meta.main) {
  await serveMcp();
}
