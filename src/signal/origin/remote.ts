import type {
  OriginScope,
  RepositoryIdentity,
} from "../types";

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
  const name = parts.repository.toLowerCase();
  const id = `${origin.id}/${name}`;
  const safeName = name
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
