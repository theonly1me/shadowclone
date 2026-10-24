import type { CloneNode } from "@shadowclone/clones";
import type { LiveSessions } from "@shadowclone/live";
import { createPairTool, pairTool } from "@shadowclone/mcp";
import type { HubStore } from "./store";
import { issuerOf } from "./store/settings";
import { fleetTools } from "./fleet/tools";
import type { NodeLinks } from "./fleet/links";
import { answerAuthorization, authorizationPage } from "./http/authorize";
import { mcpEndpoint } from "./http/mcp";
import { authorizationServerMetadata, protectedResourceMetadata } from "./http/metadata";
import { linkNode, pairNode } from "./http/nodes";
import { registerEndpoint } from "./http/register";
import { jsonResponse, lockedDescription, oauthError } from "./http/responses";
import { sourceAddress, sourceAllowed } from "./http/source";
import { tokenEndpoint } from "./http/token";

export type Hub = {
  readonly handle: (options: {
    readonly request: Request;
    readonly peer: string | null;
    readonly upgrade?: (name: string) => boolean;
  }) => Promise<Response | undefined>;
};

type Route = (options: {
  readonly request: Request;
  readonly url: URL;
  readonly issuer: string;
  readonly upgrade?: (name: string) => boolean;
}) => Promise<Response | undefined> | Response | undefined;

export function createHub(options: {
  readonly store: HubStore;
  readonly node: CloneNode;
  readonly live?: LiveSessions;
  readonly hostName: string;
  readonly links: NodeLinks;
  readonly log: (line: string) => void;
}): Hub {
  const { store, log, hostName } = options;
  const fleet = fleetTools({
    hostName,
    local: options.node,
    ...(options.live === undefined ? {} : { live: options.live }),
    links: options.links,
    store,
  });
  const pairing = createPairTool(options.live === undefined ? {} : { live: options.live });
  const tools = {
    list: [...fleet.list, pairTool],
    call: async (params: unknown) => (await pairing.run(params)) ?? fleet.call(params),
  };
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
    "POST /nodes/pair": ({ request }) => pairNode({ request, store, hostName, log }),
    "GET /nodes/link": ({ request, upgrade }) =>
      linkNode({ request, store, ...(upgrade === undefined ? {} : { upgrade }) }),
  };

  return {
    handle: async ({ request, peer, upgrade }) => {
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

      return route({
        request,
        url,
        issuer: issuerOf(settings),
        ...(upgrade === undefined ? {} : { upgrade }),
      });
    },
  };
}
