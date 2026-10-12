import page from "./client/index.html";
import { createBrowserHandler } from "./handler";
import { browserAssetRoutes } from "./assets";
import type { BuildContext, BuildScope } from "@shadowclone/environment";

export function serveBuildWizard(
  options: BuildContext & {
    readonly scope?: BuildScope;
    readonly port?: number;
  },
) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  let origin = "";
  const handler = createBrowserHandler({
    ...options,
    token,
    origin: () => origin,
  });

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: options.port ?? 0,
    development: false,
    maxRequestBodySize: 2_000_000,
    idleTimeout: 90,
    routes: browserAssetRoutes({ page, directory: import.meta.dir }),
    fetch: handler,
  });

  origin = `http://127.0.0.1:${server.port}`;

  const parameters = new URLSearchParams({ scope: options.scope ?? "global" });

  const url = `${origin}/?${parameters}#${token}`;

  return { url, origin, token, stop: () => server.stop(true) };
}
