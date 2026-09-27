import page from "./client/index.html";
import type { BuildContext, BuildScope } from "../builds/types";
import { createBrowserHandler } from "./handler";
import { browserAssetRoutes } from "./assets";

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
    routes: browserAssetRoutes({ page, directory: import.meta.dir }),
    fetch: handler,
  });

  origin = `http://127.0.0.1:${server.port}`;

  const url = `${origin}/?scope=${options.scope ?? "global"}#${token}`;

  return { url, origin, token, stop: () => server.stop(true) };
}
