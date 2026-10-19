import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { assertRegularDestination } from "@shadowclone/core";
import type { HubPaths } from "../paths";
import { nodeNamePattern } from "../store/nodes";
import type { NodeLink } from "./client";
import { parseMessage, type FetchCall } from "./protocol";

const linkSchema = z.object({
  hubUrl: z.string(),
  name: z.string().regex(nodeNamePattern),
  token: z.string().min(20),
});

const joinedSchema = z.object({ name: z.string(), token: z.string().min(20) });

const errorSchema = z.object({ error_description: z.string() });

export function hubOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    const loopback = url.protocol === "http:" && url.hostname === "127.0.0.1";

    return (url.protocol === "https:" || loopback) &&
      (url.pathname === "/" || url.pathname === "/mcp")
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export async function readLink(paths: HubPaths): Promise<NodeLink | null> {
  const text = await readFile(paths.linkFile, "utf8").catch(() => null);

  if (text === null) {
    return null;
  }

  const link = linkSchema.safeParse(parseMessage(text));

  if (!link.success) {
    throw new Error(`${paths.linkFile} is not a hub link. Run shadowclone hub join again.`);
  }

  return link.data;
}

export async function saveLink(options: {
  readonly paths: HubPaths;
  readonly link: NodeLink;
}): Promise<void> {
  assertRegularDestination(options.paths.linkFile);
  await mkdir(path.dirname(options.paths.linkFile), { recursive: true, mode: 0o700 });
  await writeFile(options.paths.linkFile, `${JSON.stringify(options.link, null, 2)}\n`, {
    mode: 0o600,
  });
  await chmod(options.paths.linkFile, 0o600);
}

export async function removeLink(paths: HubPaths): Promise<boolean> {
  const existed = (await readLink(paths).catch(() => null)) !== null;

  await rm(paths.linkFile, { force: true });

  return existed;
}

export type JoinOutcome =
  | { readonly kind: "joined"; readonly link: NodeLink }
  | { readonly kind: "refused"; readonly reason: string };

export async function joinHub(options: {
  readonly paths: HubPaths;
  readonly hubUrl: string;
  readonly code: string;
  readonly name: string;
  readonly fetch?: FetchCall;
}): Promise<JoinOutcome> {
  const origin = hubOrigin(options.hubUrl);

  if (origin === null) {
    return { kind: "refused", reason: "Pass the hub URL, such as https://studio.tail1234.ts.net." };
  }

  if (!nodeNamePattern.test(options.name)) {
    return { kind: "refused", reason: "A node name uses lowercase letters, digits, and dashes." };
  }

  const response = await (options.fetch ?? fetch)(`${origin}/nodes/pair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: options.code, name: options.name }),
    signal: AbortSignal.timeout(20_000),
  }).catch((error: unknown) => (error instanceof Error ? error.message : String(error)));

  if (typeof response === "string") {
    return { kind: "refused", reason: `The hub at ${origin} is unreachable: ${response}` };
  }

  const body = parseMessage(await response.text());
  const joined = joinedSchema.safeParse(body);

  if (!response.ok || !joined.success) {
    const error = errorSchema.safeParse(body);

    return {
      kind: "refused",
      reason: error.success ? error.data.error_description : `The hub answered ${response.status}.`,
    };
  }

  const link = { hubUrl: origin, name: joined.data.name, token: joined.data.token };

  await saveLink({ paths: options.paths, link });

  return { kind: "joined", link };
}
