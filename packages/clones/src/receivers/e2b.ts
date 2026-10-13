import { sandboxTemplateName, type LaunchSandbox } from "./launch";

export const e2bApi = "https://api.e2b.app";

const sessionSeconds = 3 * 60 * 60;

function connectEnvelope(message: unknown): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(JSON.stringify(message));
  const body = new Uint8Array(new ArrayBuffer(5 + encoded.length));

  new DataView(body.buffer).setUint32(1, encoded.length);
  body.set(encoded, 5);

  return body;
}

async function waitForStart(response: Response): Promise<void> {
  const reader = response.body?.getReader();

  if (!response.ok || reader === undefined) {
    throw new Error(`E2B refused the process start (${response.status}).`);
  }

  let text = "";

  try {
    for (let read = await reader.read(); !read.done; read = await reader.read()) {
      text += new TextDecoder().decode(read.value);

      if (text.includes('"start"')) {
        return;
      }
    }
  } finally {
    await reader.cancel();
  }

  throw new Error("E2B closed the process stream before the command started.");
}

export const launchE2b: LaunchSandbox = async (options) => {
  const created = await options.fetch(`${e2bApi}/v2/sandboxes`, {
    method: "POST",
    headers: { "X-API-Key": options.secrets.E2B_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({
      templateID: sandboxTemplateName(options.image),
      timeout: sessionSeconds,
      allow_internet_access: true,
    }),
  });

  if (!created.ok) {
    throw new Error(`E2B answered ${created.status}: ${(await created.text()).slice(0, 300)}`);
  }

  const sandbox: unknown = await created.json();
  const fields =
    typeof sandbox === "object" && sandbox !== null
      ? Object.fromEntries(Object.entries(sandbox))
      : {};
  const id = typeof fields.sandboxID === "string" ? fields.sandboxID : "";
  const domain =
    typeof fields.domain === "string" && fields.domain !== "" ? fields.domain : "e2b.app";
  const token = typeof fields.envdAccessToken === "string" ? fields.envdAccessToken : "";

  await waitForStart(
    await options.fetch(`https://49983-${id}.${domain}/process.Process/Start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/connect+json",
        "X-Access-Token": token,
        Authorization: `Basic ${btoa("clone:")}`,
      },
      body: connectEnvelope({
        process: {
          cmd: "/bin/bash",
          args: ["-l", "-c", "shadowclone session run"],
          envs: options.environment,
        },
        stdin: false,
        tag: "shadowclone",
      }),
    }),
  );
};
