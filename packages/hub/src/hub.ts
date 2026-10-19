import { createSessionsTools, sessionsTools } from "@shadowclone/mcp";
import type { CloneNode } from "@shadowclone/clones";
import type { HubStore } from "./store";
import { issuerOf } from "./store/settings";
import { answerAuthorization, authorizationPage } from "./http/authorize";
import { mcpEndpoint } from "./http/mcp";
import { authorizationServerMetadata, protectedResourceMetadata } from "./http/metadata";
import { registerEndpoint } from "./http/register";
import { jsonResponse, lockedDescription, oauthError } from "./http/responses";
import { sourceAddress, sourceAllowed } from "./http/source";
import { tokenEndpoint } from "./http/token";

export type Hub = {
  readonly handle: (options: {
    readonly request: Request;
    readonly peer: string | null;
  }) => Promise<Response>;
};

type Route = (options: {
  readonly request: Request;
  readonly url: URL;
  readonly issuer: string;
}) => Promise<Response> | Response;

export function createHub(options: {
  readonly store: HubStore;
  readonly node: CloneNode;
  readonly log: (line: string) => void;
}): Hub {
  const { store, log } = options;
  const sessions = createSessionsTools({ node: options.node });
  const tools = { list: sessionsTools, call: sessions.run };
  const routes: Readonly<Record<string, Route>> = {
    "GET /.well-known/oauth-protected-resource": ({ issuer }) => protectedResourceMetadata(issuer),
    "GET /.well-known/oauth-protected-resource/mcp": ({ issuer }) =>
      protectedResourceMetadata(issuer),
    "GET /.well-known/oauth-authorization-server": ({ issuer }) =>
      authorizationServerMetadata(issuer),
    "POST /register": ({ request }) => registerEndpoint({ request, store }),
    "GET /authorize": ({ url, issuer }) => authorizationPage({ url, store, issuer }),
    "POST /authorize": ({ request, issuer }) =>
      answerAuthorization({ request, store, issuer, log }),
    "POST /token": ({ request }) => tokenEndpoint({ request, store }),
    "POST /mcp": ({ request, issuer }) => mcpEndpoint({ request, store, issuer, tools }),
  };

  return {
    handle: async ({ request, peer }) => {
      const settings = store.settings();
      const url = new URL(request.url);
      const source = sourceAddress({ peer, forwardedFor: request.headers.get("X-Forwarded-For") });

      if (!sourceAllowed({ source, allow: settings.allow })) {
        log(`Refused a request from ${source ?? "an unknown address"} outside the allowlist.`);

        return oauthError({
          status: 403,
          error: "access_denied",
          description: "The hub does not accept this address.",
        });
      }

      if (settings.locked) {
        return oauthError({
          status: 423,
          error: "temporarily_unavailable",
          description: lockedDescription,
        });
      }

      const route = routes[`${request.method} ${url.pathname}`];

      if (route === undefined) {
        return url.pathname === "/mcp"
          ? new Response(null, { status: 405, headers: { Allow: "POST" } })
          : jsonResponse({ status: 404, body: { error: "not_found" } });
      }

      return route({ request, url, issuer: issuerOf(settings) });
    },
  };
}
