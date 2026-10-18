import { describe, expect, test } from "bun:test";
import { testHub } from "./fixtures";
import { authorizePath, connect, registerClient, rpc } from "./oauthSteps";

describe("hub guards", () => {
  test("a source outside the allowlist gets 403, and an Anthropic address through the local proxy passes", async () => {
    const hub = await testHub();

    try {
      const { accessToken } = await connect(hub);

      hub.store.setSetting({ key: "allow", value: JSON.stringify(["anthropic"]) });

      const call = (forwarded: string, peer = "127.0.0.1") =>
        hub.call({
          ...rpc({ token: accessToken, method: "ping", headers: { "X-Forwarded-For": forwarded } }),
          peer,
        });

      expect((await call("203.0.113.9")).status).toBe(403);
      expect((await call("160.79.104.10")).status).toBe(200);
      expect((await call("160.79.104.10", "203.0.113.9")).status).toBe(403);
    } finally {
      await hub.remove();
    }
  });

  test("the tailnet name covers Tailscale IPv6 addresses", async () => {
    const hub = await testHub();

    try {
      hub.store.setSetting({ key: "allow", value: JSON.stringify(["tailnet"]) });

      const metadata = (peer: string) =>
        hub.call({ path: "/.well-known/oauth-authorization-server", peer });

      expect((await metadata("fd7a:115c:a1e0::1234")).status).toBe(200);
      expect((await metadata("::ffff:100.101.102.103")).status).toBe(200);
      expect((await metadata("2001:db8::1")).status).toBe(403);
    } finally {
      await hub.remove();
    }
  });

  test("a locked hub refuses every request until it unlocks", async () => {
    const hub = await testHub();

    try {
      const { accessToken } = await connect(hub);

      hub.store.setSetting({ key: "locked", value: "yes" });

      expect((await hub.call(rpc({ token: accessToken, method: "ping" }))).status).toBe(423);
      expect((await hub.call({ path: "/.well-known/oauth-authorization-server" })).status).toBe(
        423,
      );

      hub.store.setSetting({ key: "locked", value: "no" });

      expect((await hub.call(rpc({ token: accessToken, method: "ping" }))).status).toBe(200);
    } finally {
      await hub.remove();
    }
  });

  test("an unknown Origin gets 403, and an unsupported protocol version gets 400", async () => {
    const hub = await testHub();

    try {
      const { accessToken } = await connect(hub);
      const origin = await hub.call(
        rpc({ token: accessToken, method: "ping", headers: { Origin: "https://evil.example" } }),
      );
      const version = await hub.call(
        rpc({
          token: accessToken,
          method: "ping",
          headers: { "MCP-Protocol-Version": "1999-01-01" },
        }),
      );

      expect(origin.status).toBe(403);
      expect(version.status).toBe(400);
    } finally {
      await hub.remove();
    }
  });

  test("a notification gets 202 with no body", async () => {
    const hub = await testHub();

    try {
      const { accessToken } = await connect(hub);
      const response = await hub.call({
        ...rpc({ token: accessToken, method: "unused" }),
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      });

      expect(response.status).toBe(202);
      expect(await response.text()).toBe("");
    } finally {
      await hub.remove();
    }
  });

  test("registration refuses an http redirect outside loopback, and a loopback redirect matches on any port", async () => {
    const hub = await testHub();

    try {
      const refused = await hub.call({
        method: "POST",
        path: "/register",
        body: JSON.stringify({ redirect_uris: ["http://attacker.example/callback"] }),
      });

      expect(refused.status).toBe(400);

      const clientId = await registerClient(hub, ["http://localhost:3118/callback"]);
      const page = await hub.call({
        path: authorizePath({ clientId, redirectUri: "http://localhost:50123/callback" }),
      });
      const wrongPath = await hub.call({
        path: authorizePath({ clientId, redirectUri: "http://localhost:50123/other" }),
      });

      expect(page.status).toBe(200);
      expect(await page.text()).toContain("Any program on that computer can claim this name.");
      expect(wrongPath.status).toBe(400);
    } finally {
      await hub.remove();
    }
  });
});
