import type { IndexedEvent } from "../index";
import type { OriginScope } from "./types";

export type GitRemoteReader = (cwd: string) => Promise<string | null>;

function isolatedOrigin(key: string): OriginScope {
  const digest = new Bun.CryptoHasher("sha256")
    .update(key)
    .digest("hex")
    .slice(0, 16);
  return {
    id: `isolated:${digest}`,
    directoryName: `isolated--${digest}`,
    promotable: false,
  };
}

function remoteParts(remote: string): {
  readonly host: string;
  readonly owner: string;
} | null {
  const trimmed = remote.trim();
  const secureShellMatch = trimmed.match(
    /^(?:[^@]+@)?([^/:]+):([^/]+)\/.+$/,
  );
  if (secureShellMatch) {
    const [, host, owner] = secureShellMatch;
    return host && owner ? { host, owner } : null;
  }

  try {
    const parsed = new URL(trimmed);
    const [owner] = parsed.pathname.split("/").filter(Boolean);
    return owner
      ? { host: parsed.hostname, owner: decodeURIComponent(owner) }
      : null;
  } catch {
    return null;
  }
}

export function normalizeRemoteOrigin(remote: string): OriginScope | null {
  const parts = remoteParts(remote);
  if (parts === null) {
    return null;
  }

  const host = parts.host.toLowerCase();
  const owner = parts.owner.toLowerCase();
  const id = `${host}/${owner}`;
  const directoryName = id.replace(/[^a-z0-9._-]+/g, "--");
  return { id, directoryName, promotable: true };
}

export async function readGitRemote(cwd: string): Promise<string | null> {
  const process = Bun.spawn({
    cmd: ["git", "-C", cwd, "config", "--local", "--get", "remote.origin.url"],
    stdout: "pipe",
    stderr: "ignore",
  });
  const [exitCode, stdout] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
  ]);
  const value = stdout.trim();
  return exitCode === 0 && value.length > 0 ? value : null;
}

function eventOriginKey(event: IndexedEvent): string {
  return event.cwd.length > 0
    ? event.cwd
    : `${event.source}:${event.sessionId}`;
}

export async function resolveEventOrigins(options: {
  readonly events: readonly IndexedEvent[];
  readonly enabled: boolean;
  readonly readRemote?: GitRemoteReader;
}): Promise<ReadonlyMap<string, OriginScope>> {
  const origins = new Map<string, OriginScope>();
  const readRemote = options.readRemote ?? readGitRemote;

  for (const event of options.events) {
    const key = eventOriginKey(event);
    if (origins.has(key)) {
      continue;
    }

    const remote =
      options.enabled && event.cwd.length > 0
        ? await readRemote(event.cwd)
        : null;
    origins.set(
      key,
      remote === null
        ? isolatedOrigin(key)
        : normalizeRemoteOrigin(remote) ?? isolatedOrigin(key),
    );
  }

  return origins;
}

export function getEventOrigin(options: {
  readonly event: IndexedEvent;
  readonly origins: ReadonlyMap<string, OriginScope>;
}): OriginScope {
  return (
    options.origins.get(eventOriginKey(options.event)) ??
    isolatedOrigin(eventOriginKey(options.event))
  );
}
