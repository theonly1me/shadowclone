import { jsonResponse } from "./responses";

export const hubScope = "sessions";

export function resourceOf(issuer: string): string {
  return `${issuer}/mcp`;
}

export function resourceMetadataUrl(issuer: string): string {
  return `${issuer}/.well-known/oauth-protected-resource`;
}

export function protectedResourceMetadata(issuer: string): Response {
  return jsonResponse({
    body: {
      resource: resourceOf(issuer),
      authorization_servers: [issuer],
      scopes_supported: [hubScope],
      bearer_methods_supported: ["header"],
      resource_name: "shadowclone hub",
    },
  });
}

export function authorizationServerMetadata(issuer: string): Response {
  return jsonResponse({
    body: {
      issuer,
      authorization_endpoint: `${issuer}/authorize`,
      token_endpoint: `${issuer}/token`,
      registration_endpoint: `${issuer}/register`,
      scopes_supported: [hubScope, "offline_access"],
      response_types_supported: ["code"],
      response_modes_supported: ["query"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      authorization_response_iss_parameter_supported: true,
    },
  });
}
