import type { HubStore } from "../store";
import { accessSeconds, type TokenOutcome } from "../store/tokens";
import { jsonResponse, oauthError } from "./responses";

const maximumForm = 8192;

const verifierPattern = /^[A-Za-z0-9._~-]{43,128}$/;

function tokenResponse(outcome: TokenOutcome): Response {
  if (outcome.kind === "refused") {
    return oauthError({ error: "invalid_grant", description: outcome.reason });
  }

  return jsonResponse({
    body: {
      access_token: outcome.tokens.accessToken,
      token_type: "Bearer",
      expires_in: accessSeconds,
      refresh_token: outcome.tokens.refreshToken,
      scope: outcome.tokens.scope,
    },
    headers: { Pragma: "no-cache" },
  });
}

export async function tokenEndpoint(options: {
  readonly request: Request;
  readonly store: HubStore;
}): Promise<Response> {
  const text = await options.request.text();
  const form = new URLSearchParams(text.length > maximumForm ? "" : text);
  const field = (name: string) => form.get(name) ?? "";
  const grantType = field("grant_type");

  if (grantType === "authorization_code") {
    if (!verifierPattern.test(field("code_verifier"))) {
      return oauthError({ error: "invalid_request", description: "Send a PKCE code_verifier." });
    }

    return tokenResponse(
      options.store.exchangeCode({
        code: field("code"),
        clientId: field("client_id"),
        redirectUri: field("redirect_uri"),
        verifier: field("code_verifier"),
      }),
    );
  }

  if (grantType === "refresh_token") {
    return tokenResponse(
      options.store.refreshTokens({
        refreshToken: field("refresh_token"),
        clientId: field("client_id"),
      }),
    );
  }

  return oauthError({
    error: "unsupported_grant_type",
    description: "Use authorization_code or refresh_token.",
  });
}
