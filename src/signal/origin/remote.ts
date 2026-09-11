import { runHostCommand } from "../../io/hostCommand";
import type { OriginScope, RepositoryIdentity } from "../types";

export type GitRemoteReader = (cwd: string) => Promise<string | null>;

export function isolatedOrigin(key: string): OriginScope {
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

type RemoteParts = {
  readonly host: string;
  readonly owner: string;
  readonly repository: string;
};

function splitRemotePath(remotePath: string): {
  readonly owner: string;
  readonly repository: string;
} | null {
  let decoded: string[];
  try {
    decoded = remotePath
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
  const segments = decoded;
  const repository = segments.at(-1);
  if (repository === undefined || segments.length < 2) {
    return null;
  }
  if (
    segments.some(
      (segment) =>
        segment === "." ||
        segment === ".." ||
        [...segment].some((character) => character.charCodeAt(0) <= 32) ||
        segment.includes("/") ||
        segment.includes("\\"),
    )
  ) {
    return null;
  }
  return {
    owner: segments.slice(0, -1).join("/"),
    repository: repository.replace(/\.git$/, ""),
  };
}

function urlRemoteParts(remote: string): RemoteParts | null {
  let parsed: URL;
  try {
    parsed = new URL(remote);
  } catch {
    return null;
  }
  if (parsed.hostname.length === 0) {
    return null;
  }
  const parts = splitRemotePath(parsed.pathname);
  return parts === null
    ? null
    : {
        host:
          parsed.port.length > 0
            ? `${parsed.hostname}:${parsed.port}`
            : parsed.hostname,
        owner: parts.owner,
        repository: parts.repository,
      };
}

function secureShellRemoteParts(remote: string): RemoteParts | null {
  const match = remote.match(/^(?:[^@/]+@)?([^/:]+):([^/].*)$/);
  if (!match) {
    return null;
  }
  const [, host, remotePath] = match;
  if (!host || !remotePath) {
    return null;
  }
  const parts = splitRemotePath(remotePath);
  return parts === null
    ? null
    : { host, owner: parts.owner, repository: parts.repository };
}

function remoteParts(remote: string): RemoteParts | null {
  const trimmed = remote.trim();
  return urlRemoteParts(trimmed) ?? secureShellRemoteParts(trimmed);
}

export function normalizeRemoteOrigin(remote: string): OriginScope | null {
  const parts = remoteParts(remote);
  if (parts === null) {
    return null;
  }

  const host = parts.host.toLowerCase();
  const owner = ["github.com", "gitlab.com"].includes(host)
    ? parts.owner.toLowerCase()
    : parts.owner;
  const id = `${host}/${owner}`;
  const directoryName = originDirectoryName(id);
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
  const name = ["github.com", "gitlab.com"].includes(parts.host.toLowerCase())
    ? parts.repository.toLowerCase()
    : parts.repository;
  const id = `${origin.id}/${name}`;
  const safeName =
    name
      .replace(/[^a-z0-9._-]+/g, "--")
      .replace(/^[._-]+|[._-]+$/g, "")
      .slice(0, 64) || "repository";
  const digest = new Bun.CryptoHasher("sha256")
    .update(id)
    .digest("hex")
    .slice(0, 16);
  return {
    id,
    name,
    profileFileName: `${safeName}--${digest}`,
    origin,
  };
}

export async function readGitRemote(cwd: string): Promise<string | null> {
  const { exitCode, stdout } = await runHostCommand({
    arguments: [
      "git",
      "-C",
      cwd,
      "config",
      "--local",
      "--get",
      "remote.origin.url",
    ],
    cwd,
  });
  const value = stdout.trim();
  return exitCode === 0 && value.length > 0 ? value : null;
}

export function originDirectoryName(id: string): string {
  if (id.startsWith("isolated:")) {
    return id.replace(":", "--");
  }
  const digest = new Bun.CryptoHasher("sha256")
    .update(id)
    .digest("hex")
    .slice(0, 16);
  return `${id
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "--")
    .slice(0, 80)}--${digest}`;
}
