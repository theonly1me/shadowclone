import os from "node:os";
import { z } from "zod";
import type { Processes } from "@shadowclone/clones";
import type { HubStore } from "./store";

export type ExposeOutcome =
  | { readonly kind: "exposed"; readonly publicUrl: string }
  | { readonly kind: "hidden" }
  | { readonly kind: "failed"; readonly detail: string };

const macTailscale = "/Applications/Tailscale.app/Contents/MacOS/Tailscale";

const statusSchema = z.object({ Self: z.object({ DNSName: z.string().min(1) }) });

const missingTailscale =
  "Tailscale is not installed or not running. Install it from https://tailscale.com/download and sign in, or pass --url with the HTTPS address of your own proxy.";

export function publicOrigin(value: string): string | null {
  try {
    const url = new URL(value);

    return url.protocol === "https:" && url.pathname === "/" && url.search === "" && url.hash === ""
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

async function tailscale(options: {
  readonly processes: Processes;
  readonly arguments: readonly string[];
}): Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }> {
  const executable =
    Bun.which("tailscale") ?? (process.platform === "darwin" ? macTailscale : "tailscale");

  try {
    return await options.processes.run({
      arguments: [executable, ...options.arguments],
      cwd: os.homedir(),
    });
  } catch {
    return { exitCode: 127, stdout: "", stderr: missingTailscale };
  }
}

export async function exposeHub(options: {
  readonly store: HubStore;
  readonly processes: Processes;
  readonly url?: string;
  readonly off?: boolean;
  readonly tailnetOnly?: boolean;
}): Promise<ExposeOutcome> {
  const mode = options.tailnetOnly === true ? "serve" : "funnel";
  const { store, processes } = options;
  const target = `http://127.0.0.1:${store.settings().port}`;

  if (options.url !== undefined) {
    const origin = publicOrigin(options.url);

    if (origin === null) {
      return {
        kind: "failed",
        detail: "Pass an https URL with no path, such as https://hub.example.com.",
      };
    }

    store.setSetting({ key: "publicUrl", value: origin });

    return { kind: "exposed", publicUrl: origin };
  }

  if (options.off === true) {
    const stopped = await tailscale({
      processes,
      arguments: [mode, "--https=443", target, "off"],
    });

    store.setSetting({ key: "publicUrl", value: null });

    return stopped.exitCode === 0
      ? { kind: "hidden" }
      : { kind: "failed", detail: stopped.stderr.trim() };
  }

  const funnel = await tailscale({
    processes,
    arguments: [mode, "--bg", "--https=443", target],
  });

  if (funnel.exitCode !== 0) {
    return {
      kind: "failed",
      detail: `${funnel.stdout}\n${funnel.stderr}`.trim() || missingTailscale,
    };
  }

  const status = await tailscale({ processes, arguments: ["status", "--json"] });
  const parsed = statusSchema.safeParse(parseStatus(status.stdout));

  if (!parsed.success) {
    return { kind: "failed", detail: "Tailscale did not report the name of this machine." };
  }

  const publicUrl = `https://${parsed.data.Self.DNSName.replace(/\.$/, "")}`;

  store.setSetting({ key: "publicUrl", value: publicUrl });

  return { kind: "exposed", publicUrl };
}

function parseStatus(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
