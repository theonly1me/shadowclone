import { describe, expect, test } from "bun:test";
import { claudeCallback, issuer, testHub } from "./fixtures";
import {
  authorizePath,
  connect,
  consentIdOf,
  postToken,
  registerClient,
  rpc,
  submitCode,
} from "./oauthSteps";

describe("a connector signs in to the hub", () => {
  test("a call with no token gets 401 with the resource metadata address", async () => {
    const hub = await testHub();

    try {
      const response = await hub.call({ method: "POST", path: "/mcp", body: "{}" });

      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toBe(
        `Bearer resource_metadata="${issuer}/.well-known/oauth-protected-resource"`,
      );

      const metadata = await (
        await hub.call({ path: "/.well-known/oauth-protected-resource" })
      ).json();

      expect(metadata).toMatchObject({
        resource: `${issuer}/mcp`,
        authorization_servers: [issuer],
      });
    } finally {
      await hub.remove();
    }
  });

  test("the owner approves with a pairing code, and the token reaches the clone tools", async () => {
    const hub = await testHub();

    try {
      const clientId = await registerClient(hub);
      const page = await hub.call({ path: authorizePath({ clientId }) });
      const html = await page.text();

      expect(page.status).toBe(200);
      expect(html).toContain("Connect Claude");
      expect(html).toContain("claude.ai");

      const { code } = hub.store.createPairingCode("client");
      const approved = await submitCode({ hub, consentId: consentIdOf(html), code });
      const location = new URL(approved.headers.get("Location") ?? "");

      expect(approved.status).toBe(302);
      expect(`${location.origin}${location.pathname}`).toBe(claudeCallback);
      expect(location.searchParams.get("state")).toBe("state-1");
      expect(location.searchParams.get("iss")).toBe(issuer);

      const tokens = await postToken({
        hub,
        fields: {
          grant_type: "authorization_code",
          code: location.searchParams.get("code") ?? "",
          client_id: clientId,
          redirect_uri: claudeCallback,
          code_verifier: "v".repeat(43),
        },
      });

      expect(tokens.status).toBe(200);
      expect(tokens.body).toMatchObject({ token_type: "Bearer", expires_in: 3600 });

      const token = String(tokens.body.access_token);
      const initialized = await (
        await hub.call(
          rpc({ token, method: "initialize", params: { protocolVersion: "2025-06-18" } }),
        )
      ).json();

      expect(initialized.result.protocolVersion).toBe("2025-06-18");

      const listed = await (await hub.call(rpc({ token, method: "tools/list" }))).json();

      expect(listed.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
        "shadowclone_sessions",
        "shadowclone_clone",
        "shadowclone_pair",
      ]);

      const started = await (
        await hub.call(
          rpc({
            token,
            method: "tools/call",
            params: {
              name: "shadowclone_clone",
              arguments: { operation: "start", repository: "you/app", task: "fix the parser" },
            },
          }),
        )
      ).json();

      expect(hub.started).toEqual([
        { repository: "you/app", task: "fix the parser", review: false },
      ]);
      expect(started.result.content[0].text).toContain("The fake node starts nothing.");
    } finally {
      await hub.remove();
    }
  });

  test("a request without S256 PKCE goes back with invalid_request and shows no consent page", async () => {
    const hub = await testHub();

    try {
      const clientId = await registerClient(hub);
      const response = await hub.call({ path: authorizePath({ clientId, method: "plain" }) });
      const location = new URL(response.headers.get("Location") ?? "");

      expect(response.status).toBe(302);
      expect(location.searchParams.get("error")).toBe("invalid_request");
    } finally {
      await hub.remove();
    }
  });

  test("a code exchange with the wrong verifier fails", async () => {
    const hub = await testHub();

    try {
      const clientId = await registerClient(hub);
      const page = await hub.call({ path: authorizePath({ clientId }) });
      const { code } = hub.store.createPairingCode("client");
      const approved = await submitCode({ hub, consentId: consentIdOf(await page.text()), code });
      const tokens = await postToken({
        hub,
        fields: {
          grant_type: "authorization_code",
          code: new URL(approved.headers.get("Location") ?? "").searchParams.get("code") ?? "",
          client_id: clientId,
          redirect_uri: claudeCallback,
          code_verifier: "w".repeat(43),
        },
      });

      expect(tokens.status).toBe(400);
      expect(tokens.body.error).toBe("invalid_grant");
    } finally {
      await hub.remove();
    }
  });

  test("a revoked client gets 401", async () => {
    const hub = await testHub();

    try {
      const { clientId, accessToken } = await connect(hub);

      expect((await hub.call(rpc({ token: accessToken, method: "ping" }))).status).toBe(200);
      expect(hub.store.revokeClient(clientId)).toBe(true);
      expect((await hub.call(rpc({ token: accessToken, method: "ping" }))).status).toBe(401);
    } finally {
      await hub.remove();
    }
  });
});
