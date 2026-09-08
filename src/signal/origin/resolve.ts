import type { IndexedEvent } from "../../index";
import type {
  OriginScope,
  RepositoryIdentity,
} from "../types";
import {
  isolatedOrigin,
  normalizeRemoteOrigin,
  normalizeRemoteRepository,
  readGitRemote,
} from "./remote";
import type { GitRemoteReader } from "./remote";

function eventOriginKey(event: IndexedEvent): string {
  return event.cwd.length > 0
    ? event.cwd
    : `${event.source}:${event.sessionId}`;
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
  readonly fallbackKey?: string;
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
    fallbackKey: options.fallbackKey,
    enabled: false,
  });
  return { id: origin.id, name: null, origin };
}

export async function resolveEventRepositories(options: {
  readonly events: readonly IndexedEvent[];
  readonly enabled: boolean;
  readonly readRemote?: GitRemoteReader;
}): Promise<ReadonlyMap<string, RepositoryIdentity>> {
  const repositories = new Map<string, RepositoryIdentity>();
  const readRemote = options.readRemote ?? readGitRemote;

  for (const event of options.events) {
    const key = eventOriginKey(event);
    if (repositories.has(key)) {
      continue;
    }

    repositories.set(
      key,
      await resolveRepository({
        cwd: event.cwd,
        fallbackKey: key,
        enabled: options.enabled,
        readRemote,
      }),
    );
  }

  return repositories;
}

export function getEventRepository(options: {
  readonly event: IndexedEvent;
  readonly repositories: ReadonlyMap<string, RepositoryIdentity>;
}): RepositoryIdentity {
  const key = eventOriginKey(options.event);
  const known = options.repositories.get(key);
  if (known) {
    return known;
  }
  const origin = isolatedOrigin(key);
  return { id: origin.id, name: null, origin };
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
