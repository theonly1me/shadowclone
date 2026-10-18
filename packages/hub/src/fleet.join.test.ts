import { describe, expect, test } from "bun:test";
import { testHub } from "./fixtures";
import { nodeProtocols } from "./fleet/protocol";
import { rpc } from "./oauthSteps";

function pair(options: { readonly code: string; readonly name: string }) {
  return {
    method: "POST",
    path: "/nodes/pair",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  };
}

describe("a machine joins the hub as a node", () => {
  test("a node code gives a token that opens the link and reaches the clone tools", async () => {
    const hub = await testHub();

    try {
      const { code } = hub.store.createPairingCode("node");
      const joined = await hub.call(pair({ code, name: "work" }));
      const body = await joined.json();
      const upgraded: string[] = [];
      const link = await hub.call({
        path: "/nodes/link",
        headers: { "Sec-WebSocket-Protocol": nodeProtocols(body.token).join(", ") },
        upgrade: (name) => {
          upgraded.push(name);

          return true;
        },
      });
      const tools = await hub.call(rpc({ token: body.token, method: "tools/list" }));

      expect(joined.status).toBe(201);
      expect(body.name).toBe("work");
      expect(link.status).toBe(101);
      expect(upgraded).toEqual(["work"]);
      expect(tools.status).toBe(200);
    } finally {
      await hub.remove();
    }
  });

  test("a client code cannot join a node, and a link without a node token gets 401", async () => {
    const hub = await testHub();

    try {
      const { code } = hub.store.createPairingCode("client");
      const refused = await hub.call(pair({ code, name: "work" }));
      const link = await hub.call({
        path: "/nodes/link",
        headers: { "Sec-WebSocket-Protocol": nodeProtocols("not-a-node-token-at-all").join(", ") },
        upgrade: () => true,
      });

      expect(refused.status).toBe(400);
      expect(link.status).toBe(401);
      expect(hub.store.listNodes()).toEqual([]);
    } finally {
      await hub.remove();
    }
  });

  test("a node cannot take the name of the hub machine", async () => {
    const hub = await testHub();

    try {
      const { code } = hub.store.createPairingCode("node");
      const refused = await hub.call(pair({ code, name: "studio" }));

      expect(refused.status).toBe(400);
      expect((await refused.json()).error_description).toBe(
        "That name belongs to the hub machine.",
      );
    } finally {
      await hub.remove();
    }
  });

  test("a removed node's token stops working", async () => {
    const hub = await testHub();

    try {
      const token = hub.store.joinNode("work");

      expect(hub.store.removeNode("work")).toBe(true);
      expect((await hub.call(rpc({ token, method: "ping" }))).status).toBe(401);
    } finally {
      await hub.remove();
    }
  });
});
