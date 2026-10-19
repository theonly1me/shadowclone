import { describe, expect, test } from "bun:test";
import { testHub, type TestHub } from "./fixtures";
import { authorizePath, consentIdOf, registerClient, submitCode } from "./oauthSteps";

async function consentFor(hub: TestHub): Promise<string> {
  const clientId = await registerClient(hub);
  const page = await hub.call({ path: authorizePath({ clientId }) });

  return consentIdOf(await page.text());
}

describe("pairing codes guard the consent page", () => {
  test("a wrong code fails, and the fifth failure locks the real code", async () => {
    const hub = await testHub();

    try {
      const consentId = await consentFor(hub);
      const { code } = hub.store.createPairingCode("client");

      for (let attempt = 1; attempt <= 5; attempt++) {
        const wrong = await submitCode({ hub, consentId, code: "WRNG-CODE" });

        expect(wrong.status).toBe(400);
        expect(await wrong.text()).toContain("The pairing code is wrong, used, or expired.");
      }

      expect((await submitCode({ hub, consentId, code })).status).toBe(400);
    } finally {
      await hub.remove();
    }
  });

  test("four wrong tries leave the real code usable", async () => {
    const hub = await testHub();

    try {
      const consentId = await consentFor(hub);
      const { code } = hub.store.createPairingCode("client");

      for (let attempt = 1; attempt <= 4; attempt++) {
        await submitCode({ hub, consentId, code: "WRNG-CODE" });
      }

      expect((await submitCode({ hub, consentId, code })).status).toBe(302);
    } finally {
      await hub.remove();
    }
  });

  test("a used code fails the second time", async () => {
    const hub = await testHub();

    try {
      const { code } = hub.store.createPairingCode("client");

      expect((await submitCode({ hub, consentId: await consentFor(hub), code })).status).toBe(302);
      expect((await submitCode({ hub, consentId: await consentFor(hub), code })).status).toBe(400);
    } finally {
      await hub.remove();
    }
  });

  test("a code fails after 10 minutes", async () => {
    const hub = await testHub();

    try {
      const { code } = hub.store.createPairingCode("client");

      hub.advance(10);

      const refused = await submitCode({ hub, consentId: await consentFor(hub), code });

      expect(refused.status).toBe(400);
      expect(await refused.text()).toContain("The pairing code is wrong, used, or expired.");
    } finally {
      await hub.remove();
    }
  });

  test("a code typed in lower case without the dash works", async () => {
    const hub = await testHub();

    try {
      const consentId = await consentFor(hub);
      const { code } = hub.store.createPairingCode("client");

      expect(
        (await submitCode({ hub, consentId, code: code.toLowerCase().replace("-", "") })).status,
      ).toBe(302);
    } finally {
      await hub.remove();
    }
  });
});
