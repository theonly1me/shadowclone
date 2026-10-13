import { z } from "zod";
import { githubData, type GithubCall } from "../github";
import type { SessionConfig } from "../session/config";

export function shortHash(value: string): string {
  return new Bun.CryptoHasher("sha256").update(value).digest("hex").slice(0, 16);
}

export function sessionRefName(branch: string): string {
  return `refs/${sessionRefPath(branch)}`;
}

function sessionRefPath(branch: string): string {
  return `shadowclone/sessions/${shortHash(branch)}`;
}

const refSchema = z.object({
  ref: z.string(),
  object: z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) }),
});

export async function readSessionHead(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly branch: string;
}): Promise<string | null> {
  const name = sessionRefName(options.branch);
  const response = await options.github({
    route: `repos/${options.config.repository}/git/ref/${sessionRefPath(options.branch)}`,
  });

  if (response.status === 404) {
    return null;
  }

  const parsed = refSchema.safeParse(response.data);

  if (response.status !== 200 || !parsed.success || parsed.data.ref !== name) {
    throw new Error(`GitHub refused GET ${name} (${response.status}).`);
  }

  return parsed.data.object.sha;
}

export async function listSessionHeads(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
}): Promise<ReadonlySet<string>> {
  const data = await githubData({
    github: options.github,
    route: `repos/${options.config.repository}/git/matching-refs/shadowclone/sessions/`,
  });

  return new Set(
    z
      .array(refSchema)
      .parse(data)
      .map((entry) => entry.object.sha),
  );
}

export async function recordSessionHead(options: {
  readonly github: GithubCall;
  readonly config: SessionConfig;
  readonly branch: string;
  readonly sha: string;
}): Promise<void> {
  const name = sessionRefName(options.branch);
  const base = `repos/${options.config.repository}/git`;
  const created = await options.github({
    method: "POST",
    route: `${base}/refs`,
    body: { ref: name, sha: options.sha },
  });

  if (created.status === 201) {
    return;
  }

  if (created.status !== 422) {
    throw new Error(`GitHub refused POST ${name} (${created.status}).`);
  }

  await githubData({
    github: options.github,
    method: "PATCH",
    route: `${base}/${name}`,
    body: { sha: options.sha, force: true },
  });
}
