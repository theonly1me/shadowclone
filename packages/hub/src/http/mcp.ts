import { resourceMetadataUrl } from "./metadata";
import { bearerToken, jsonResponse, parseJson } from "./responses";
import { answerRequest, messageSchema, protocolVersions, type RpcTools } from "./rpc";
import type { HubStore } from "../store";

const maximumBody = 262_144;

const trustedOrigins = ["https://claude.ai", "https://claude.com"];

function rpcError(options: {
  readonly status: number;
  readonly code: number;
  readonly message: string;
}): Response {
  return jsonResponse({
    status: options.status,
    body: { jsonrpc: "2.0", error: { code: options.code, message: options.message } },
  });
}

function unauthorized(options: { readonly issuer: string; readonly tokenSent: boolean }): Response {
  const error = options.tokenSent ? ', error="invalid_token"' : "";

  return new Response(null, {
    status: 401,
    headers: {
      "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl(options.issuer)}"${error}`,
      "Cache-Control": "no-store",
    },
  });
}

export async function mcpEndpoint(options: {
  readonly request: Request;
  readonly store: HubStore;
  readonly issuer: string;
  readonly tools: RpcTools;
}): Promise<Response> {
  const { request, issuer } = options;
  const origin = request.headers.get("Origin");

  if (origin !== null && origin !== new URL(issuer).origin && !trustedOrigins.includes(origin)) {
    return rpcError({ status: 403, code: -32600, message: "The hub does not accept this origin." });
  }

  const token = bearerToken(request);

  if (
    token === null ||
    (options.store.authenticate(token) === null && options.store.authenticateNode(token) === null)
  ) {
    return unauthorized({ issuer, tokenSent: token !== null });
  }

  const version = request.headers.get("MCP-Protocol-Version");

  if (version !== null && !protocolVersions.includes(version)) {
    return rpcError({
      status: 400,
      code: -32600,
      message: `Unsupported protocol version ${version}.`,
    });
  }

  const text = await request.text();
  const parsed = text.length > maximumBody ? null : messageSchema.safeParse(parseJson(text));

  if (parsed?.success !== true) {
    return rpcError({ status: 400, code: -32700, message: "Send one JSON-RPC message." });
  }

  const message = parsed.data;

  if (!("method" in message) || !("id" in message)) {
    return new Response(null, { status: 202 });
  }

  return jsonResponse({
    body: await answerRequest({
      id: message.id,
      method: message.method,
      params: message.params,
      tools: options.tools,
    }),
  });
}
