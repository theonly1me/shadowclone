import { describe, expect, test } from "bun:test";
import { claudeCallback, testHub, verifier } from "./fixtures";
import {
  authorizePath,
  connect,
  consentIdOf,
  postToken,
  registerClient,
  rpc,
  submitCode,
} from "./oauthSteps";

describe("hub tokens", () => {
  test("a rotated refresh token fails on reuse and revokes the tokens that replaced it", async () => {
    const hub = await testHub();

    try {
      const { clientId, refreshToken } = await connect(hub);
      const rotated = await postToken({
        hub,
        fields: { grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId },
      });

      expect(rotated.status).toBe(200);
      expect(rotated.body.refresh_token).not.toBe(refreshToken);

      const reused = await postToken({
        hub,
        fields: { grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId },
      });

      expect(reused.status).toBe(400);
      expect(reused.body.error).toBe("invalid_grant");
      expect(
        (await hub.call(rpc({ token: String(rotated.body.access_token), method: "ping" }))).status,
      ).toBe(401);
    } finally {
      await hub.remove();
    }
  });

  test("an authorization code works once, and a second exchange revokes its tokens", async () => {
    const hub = await testHub();

    try {
      const clientId = await registerClient(hub);
      const page = await hub.call({ path: authorizePath({ clientId }) });
      const { code } = hub.store.createPairingCode("client");
      const approved = await submitCode({ hub, consentId: consentIdOf(await page.text()), code });
      const fields = {
        grant_type: "authorization_code",
        code: new URL(approved.headers.get("Location") ?? "").searchParams.get("code") ?? "",
        client_id: clientId,
        redirect_uri: claudeCallback,
        code_verifier: verifier,
      };
      const first = await postToken({ hub, fields });
      const second = await postToken({ hub, fields });

      expect(first.status).toBe(200);
      expect(second.status).toBe(400);
      expect(
        (await hub.call(rpc({ token: String(first.body.access_token), method: "ping" }))).status,
      ).toBe(401);
    } finally {
      await hub.remove();
    }
  });

  test("an access token stops working after one hour, and a refresh gives a new one", async () => {
    const hub = await testHub();

    try {
      const { clientId, accessToken, refreshToken } = await connect(hub);

      hub.advance(61);

      expect((await hub.call(rpc({ token: accessToken, method: "ping" }))).status).toBe(401);

      const refreshed = await postToken({
        hub,
        fields: { grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId },
      });

      expect(
        (await hub.call(rpc({ token: String(refreshed.body.access_token), method: "ping" })))
          .status,
      ).toBe(200);
    } finally {
      await hub.remove();
    }
  });

  test("a refresh token of another client fails", async () => {
    const hub = await testHub();

    try {
      const { refreshToken } = await connect(hub);
      const other = await registerClient(hub);
      const refused = await postToken({
        hub,
        fields: { grant_type: "refresh_token", refresh_token: refreshToken, client_id: other },
      });

      expect(refused.body.error).toBe("invalid_grant");
    } finally {
      await hub.remove();
    }
  });
});
