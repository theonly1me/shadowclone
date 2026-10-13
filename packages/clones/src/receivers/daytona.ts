import { sandboxTemplateName, type LaunchSandbox } from "./launch";

export const daytonaApi = "https://app.daytona.io/api";
export const daytonaToolbox = "https://proxy.app.daytona.io/toolbox";

const readyAttempts = 12;

async function readJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) {
    throw new Error(
      `Daytona answered ${response.status}: ${(await response.text()).slice(0, 300)}`,
    );
  }

  const value: unknown = await response.json();

  return typeof value === "object" && value !== null
    ? Object.fromEntries(Object.entries(value))
    : {};
}

export const launchDaytona: LaunchSandbox = async (options) => {
  const key = options.secrets.DAYTONA_API_KEY ?? "";
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const wait =
    options.wait ??
    ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const created = await readJson(
    await options.fetch(`${daytonaApi}/sandbox`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        snapshot: sandboxTemplateName(options.image),
        user: "clone",
        env: options.environment,
        autoStopInterval: 0,
        autoDeleteInterval: 0,
        ttlMinutes: 180,
      }),
    }),
  );
  const id = typeof created.id === "string" ? created.id : "";

  for (let attempt = 0; attempt < readyAttempts; attempt++) {
    const sandbox = await readJson(await options.fetch(`${daytonaApi}/sandbox/${id}`, { headers }));

    if (sandbox.state === "started") {
      const toolbox = `${daytonaToolbox}/${id}/process/session`;

      await readJson(
        await options.fetch(toolbox, {
          method: "POST",
          headers,
          body: JSON.stringify({ sessionId: "run" }),
        }),
      );
      await readJson(
        await options.fetch(`${toolbox}/run/exec`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            command: "shadowclone session run > /tmp/shadowclone-session.log 2>&1",
            runAsync: true,
          }),
        }),
      );
      return;
    }

    await wait(2_000);
  }

  throw new Error(`The Daytona sandbox ${id} did not start in time.`);
};
