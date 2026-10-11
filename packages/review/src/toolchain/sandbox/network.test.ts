import { expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { runTool } from "../process";

test("toolchain children cannot reach local TCP services, Unix sockets, or unapproved proxy destinations", async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "srt-net-")));
  const workspace = path.join(root, "work");
  await mkdir(workspace);
  let connections = 0;
  const tcp = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => {
      connections += 1;
      return new Response("synthetic local service");
    },
  });
  const unix = createServer((socket) => {
    connections += 1;
    socket.end();
  });
  const socketPath = path.join(workspace, "socket");
  await new Promise<void>((resolve) => unix.listen(socketPath, resolve));
  await Bun.write(
    path.join(workspace, "network.js"),
    [
      'import net from "node:net";',
      'import http from "node:http";',
      `const local = await fetch(${JSON.stringify(tcp.url.toString())}, { signal: AbortSignal.timeout(1000) }).then(() => true, () => false);`,
      `const unix = await new Promise(resolve => { const socket = net.createConnection(${JSON.stringify(socketPath)}); socket.on("connect", () => { socket.destroy(); resolve(true); }); socket.on("error", () => resolve(false)); socket.setTimeout(1000, () => { socket.destroy(); resolve(false); }); });`,
      'const remote = await fetch("http://example.com/", { proxy: process.env.HTTP_PROXY, signal: AbortSignal.timeout(1000) }).then(response => response.status, () => null);',
      'const nodeRemote = await new Promise(resolve => { const proxy = new URL(process.env.HTTP_PROXY); const authorization = Buffer.from(decodeURIComponent(proxy.username) + ":" + decodeURIComponent(proxy.password)).toString("base64"); const request = http.request(proxy, { method: "CONNECT", path: "example.com:443", headers: { "Proxy-Authorization": "Basic " + authorization } }); request.on("connect", (response, socket) => { socket.destroy(); resolve(response.statusCode); }); request.on("response", response => { response.resume(); resolve(response.statusCode); }); request.on("error", () => resolve(null)); request.setTimeout(1000, () => { request.destroy(); resolve(null); }); request.end(); });',
      'await Bun.write("result.json", JSON.stringify({ local, unix, remote, nodeRemote }));',
    ].join("\n"),
  );

  try {
    const result = await runTool({
      arguments: ["bun", "network.js"],
      cwd: workspace,
      environment: {},
      timeoutMilliseconds: 10_000,
    });
    expect(result).toMatchObject({ kind: "finished", exitCode: 0 });
    const observed: unknown = await Bun.file(path.join(workspace, "result.json")).json();
    expect(observed).toEqual({ local: false, unix: false, remote: 403, nodeRemote: 403 });
    expect(connections).toBe(0);
  } finally {
    tcp.stop(true);
    await new Promise<void>((resolve, reject) =>
      unix.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(root, { recursive: true, force: true });
  }
}, 20_000);
