import path from "node:path";
import { readEffectiveConfig } from "../config";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import { buildCompiledProfile } from "../profile";
import {
  isOriginBlocked,
  resolveCwdOrigin,
  type GitRemoteReader,
} from "../signal";

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
}): Readonly<Record<string, unknown>> | null {
  const base = { jsonrpc: "2.0", id: options.request.id };
  if (options.request.method === "initialize") {
    return {
      ...base,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "shadowclone", version: "0.1.0" },
      },
    };
  }
  if (options.request.method === "tools/list") {
    return {
      ...base,
      result: {
        tools: [
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
  const { config, policy } = await readEffectiveConfig({
    configPath: options.configPath,
    managedConfigPath:
      options.managedConfigPath === undefined
        ? options.paths.managedConfigFile
        : options.managedConfigPath,
  });
  if (!policy.enabled) {
    return "# Shadowclone profile\n";
  }
  const origin = await resolveCwdOrigin({
    cwd: options.cwd,
    enabled: config.sources["git-metadata"],
    readRemote: options.readRemote,
  });
  if (
    isOriginBlocked({
      origin,
      cwd: options.cwd,
      patterns: policy.blockedOrigins,
    })
  ) {
    return "# Shadowclone profile\n";
  }
  return buildCompiledProfile({
    profileDirectory: options.paths.profileDirectory,
    origin,
    targetRepo: path.basename(options.cwd),
  });
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
            const response = handleMcpRequest({ request, profile });
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
