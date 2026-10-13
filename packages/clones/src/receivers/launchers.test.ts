import { describe, expect, test } from "bun:test";
import { launchDaytona } from "./daytona";
import { launchE2b } from "./e2b";
import { launchers } from "./launchers";

type Call = {
  readonly url: string;
  readonly method: string;
  readonly body: string;
  readonly headers: Headers;
};

function fakeFetch(responses: readonly (() => Response)[]) {
  const calls: Call[] = [];
  let index = 0;
  const fetcher = async (url: string, init?: RequestInit): Promise<Response> => {
    const bytes = new Uint8Array(await new Response(init?.body).arrayBuffer());

    calls.push({
      url,
      method: init?.method ?? "GET",
      body: new TextDecoder().decode(typeof init?.body === "string" ? bytes : bytes.slice(5)),
      headers: new Headers(init?.headers),
    });

    const respond = responses[index++];

    if (respond === undefined) {
      throw new Error(`Unexpected request ${url}`);
    }

    return respond();
  };

  return { fetcher, calls };
}

const environment = { GH_TOKEN: "synthetic-github-token", SHADOWCLONE_SESSION_EVENT: "{}" };
const image = "ghcr.io/theonly1me/shadowclone-clone:0.0.34";

describe("sandbox launchers", () => {
  test("Daytona creates a sandbox from the clone snapshot with auto-stop off, waits for it, and runs the session in the background", async () => {
    const { fetcher, calls } = fakeFetch([
      () => Response.json({ id: "sandbox-1", state: "creating" }),
      () => Response.json({ id: "sandbox-1", state: "creating" }),
      () => Response.json({ id: "sandbox-1", state: "started" }),
      () => Response.json({}),
      () => Response.json({ cmdId: "command-1" }),
    ]);

    await launchDaytona({
      image,
      environment,
      secrets: { DAYTONA_API_KEY: "synthetic-daytona-key" },
      fetch: fetcher,
      wait: async () => undefined,
    });

    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({
      snapshot: "shadowclone-clone-0-0-34",
      user: "clone",
      env: environment,
      autoStopInterval: 0,
      autoDeleteInterval: 0,
      ttlMinutes: 180,
    });
    expect(calls[0]?.headers.get("authorization")).toBe("Bearer synthetic-daytona-key");
    expect(calls.at(-1)?.url).toBe(
      "https://proxy.app.daytona.io/toolbox/sandbox-1/process/session/run/exec",
    );
    expect(JSON.parse(calls.at(-1)?.body ?? "{}")).toMatchObject({ runAsync: true });
  });

  test("E2B starts the session command with the environment and returns once the process starts", async () => {
    const started = new TextEncoder().encode(
      '\u0000\u0000\u0000\u0000 {"event":{"start":{"pid":42}}}',
    );
    const { fetcher, calls } = fakeFetch([
      () =>
        Response.json(
          { sandboxID: "box-1", envdAccessToken: "synthetic-envd-token", domain: "e2b.app" },
          { status: 201 },
        ),
      () => new Response(started, { status: 200 }),
    ]);

    await launchE2b({
      image,
      environment,
      secrets: { E2B_API_KEY: "synthetic-e2b-key" },
      fetch: fetcher,
    });

    expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({
      templateID: "shadowclone-clone-0-0-34",
      timeout: 10800,
      allow_internet_access: true,
    });
    expect(calls[1]?.url).toBe("https://49983-box-1.e2b.app/process.Process/Start");
    expect(calls[1]?.headers.get("x-access-token")).toBe("synthetic-envd-token");
    expect(JSON.parse(calls[1]?.body ?? "{}")).toMatchObject({
      process: {
        cmd: "/bin/bash",
        args: ["-l", "-c", "shadowclone session run"],
        envs: environment,
      },
    });
  });

  test("the receivers can start a Daytona or an E2B sandbox and nothing else", () => {
    expect(Object.keys(launchers).sort()).toEqual(["daytona", "e2b"]);
  });
});
