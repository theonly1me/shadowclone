import path from "node:path";
import type { IndexedEvent } from "../index";
import type {
  OriginScope,
  RepositoryIdentity,
} from "./types";

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
  readonly repository: string;
} | null {
  const trimmed = remote.trim();
  const secureShellMatch = trimmed.match(
    /^(?:[^@]+@)?([^/:]+):([^/]+)\/(.+)$/,
  );
  if (secureShellMatch) {
    const [, host, owner, repository] = secureShellMatch;
    return host && owner && repository
      ? { host, owner, repository: repository.replace(/\.git$/, "") }
      : null;
  }

  try {
    const parsed = new URL(trimmed);
    const [owner, repository] = parsed.pathname.split("/").filter(Boolean);
    return owner && repository
      ? {
          host: parsed.hostname,
          owner: decodeURIComponent(owner),
          repository: decodeURIComponent(repository).replace(/\.git$/, ""),
        }
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

export function normalizeRemoteRepository(
  remote: string,
): RepositoryIdentity | null {
  const parts = remoteParts(remote);
  const origin = normalizeRemoteOrigin(remote);
  if (parts === null || origin === null) {
    return null;
  }
  return {
    id: `${origin.id}/${parts.repository.toLowerCase()}`,
    origin,
  };
}

function matchesPattern(value: string, pattern: string): boolean {
  const expression = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${expression}$`).test(value);
}

export function isOriginBlocked(options: {
  readonly origin: OriginScope;
  readonly cwd: string;
  readonly patterns: readonly string[];
}): boolean {
  const repository = options.cwd ? path.basename(options.cwd) : null;
  const values = [
    options.origin.id,
    ...(repository ? [`${options.origin.id}/${repository}`] : []),
  ];
  return options.patterns.some((pattern) =>
    values.some((value) => matchesPattern(value, pattern))
  );
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

    origins.set(
      key,
      await resolveCwdOrigin({
        cwd: event.cwd,
        fallbackKey: key,
        enabled: options.enabled,
        readRemote,
      }),
    );
  }

  return origins;
}

export async function resolveCwdOrigin(options: {
  readonly cwd: string;
  readonly fallbackKey?: string;
  readonly enabled: boolean;
  readonly readRemote?: GitRemoteReader;
}): Promise<OriginScope> {
  const key = options.cwd || options.fallbackKey || "unknown";
  const readRemote = options.readRemote ?? readGitRemote;
  const remote =
    options.enabled && options.cwd.length > 0
      ? await readRemote(options.cwd)
      : null;
  return remote === null
    ? isolatedOrigin(key)
    : normalizeRemoteOrigin(remote) ?? isolatedOrigin(key);
}

export async function resolveRepository(options: {
  readonly cwd: string;
  readonly enabled: boolean;
  readonly readRemote?: GitRemoteReader;
}): Promise<RepositoryIdentity> {
  const readRemote = options.readRemote ?? readGitRemote;
  const remote =
    options.enabled && options.cwd.length > 0
      ? await readRemote(options.cwd)
      : null;
  const repository = remote ? normalizeRemoteRepository(remote) : null;
  if (repository !== null) {
    return repository;
  }
  const origin = await resolveCwdOrigin({
    cwd: options.cwd,
    enabled: false,
  });
  return { id: origin.id, origin };
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
