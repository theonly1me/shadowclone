import { z } from "zod";
import type { HubStore } from "../store";
import { acceptableRedirect } from "./redirects";
import { jsonResponse, oauthError, parseJson } from "./responses";

const registrationSchema = z.object({
  redirect_uris: z.array(z.string().max(2000)).min(1).max(10),
  client_name: z.string().trim().min(1).max(100).optional(),
});

const maximumBody = 16_384;

export async function registerEndpoint(options: {
  readonly request: Request;
  readonly store: HubStore;
}): Promise<Response> {
  const text = await options.request.text();
  const input = text.length > maximumBody ? null : registrationSchema.safeParse(parseJson(text));

  if (input?.success !== true) {
    return oauthError({
      error: "invalid_client_metadata",
      description: "Send JSON with redirect_uris and an optional client_name.",
    });
  }

  const redirectUris = input.data.redirect_uris;

  if (!redirectUris.every(acceptableRedirect)) {
    return oauthError({
      error: "invalid_redirect_uri",
      description: "Each redirect URI must use https, or http on localhost or 127.0.0.1.",
    });
  }

  const client = options.store.registerClient({
    name: input.data.client_name ?? "Unnamed client",
    redirectUris,
  });

  if (client === null) {
    return oauthError({
      status: 429,
      error: "invalid_client_metadata",
      description: "Too many clients wait for approval. Try again tomorrow.",
    });
  }

  return jsonResponse({
    status: 201,
    body: {
      client_id: client.id,
      client_id_issued_at: Math.floor(new Date(client.createdAt).getTime() / 1000),
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
  });
}
