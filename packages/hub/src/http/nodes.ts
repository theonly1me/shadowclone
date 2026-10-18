import { z } from "zod";
import type { HubStore } from "../store";
import { nodeNamePattern } from "../store/nodes";
import { tokenFromProtocols } from "../fleet/protocol";
import { bearerToken, jsonResponse, oauthError, parseJson } from "./responses";

const pairSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().regex(nodeNamePattern),
});

const maximumBody = 4096;

export async function pairNode(options: {
  readonly request: Request;
  readonly store: HubStore;
  readonly hostName: string;
  readonly log: (line: string) => void;
}): Promise<Response> {
  const text = await options.request.text();
  const input = text.length > maximumBody ? null : pairSchema.safeParse(parseJson(text));

  if (input?.success !== true) {
    return oauthError({
      error: "invalid_request",
      description:
        "Send JSON with code and name. A name uses lowercase letters, digits, and dashes.",
    });
  }

  if (input.data.name === options.hostName) {
    return oauthError({
      error: "invalid_request",
      description: "That name belongs to the hub machine.",
    });
  }

  if (!options.store.redeemPairingCode({ kind: "node", code: input.data.code })) {
    options.log("A node pairing code was wrong, used, or expired.");

    return oauthError({
      error: "invalid_grant",
      description:
        "The pairing code is wrong, used, or expired. Run shadowclone hub pair --node on the hub.",
    });
  }

  const token = options.store.joinNode(input.data.name);

  options.log(`Node ${input.data.name} joined the hub.`);

  return jsonResponse({ status: 201, body: { name: input.data.name, token } });
}

export function linkNode(options: {
  readonly request: Request;
  readonly store: HubStore;
  readonly upgrade?: (name: string) => boolean;
}): Response | undefined {
  const token =
    bearerToken(options.request) ??
    tokenFromProtocols(options.request.headers.get("Sec-WebSocket-Protocol"));
  const name = token === null ? null : options.store.authenticateNode(token);

  if (name === null) {
    return oauthError({
      status: 401,
      error: "invalid_token",
      description: "Join the hub with a node pairing code.",
    });
  }

  return options.upgrade?.(name) === true
    ? undefined
    : oauthError({
        status: 426,
        error: "invalid_request",
        description: "Connect with a WebSocket.",
      });
}
