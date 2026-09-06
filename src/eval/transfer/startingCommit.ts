import type { Evidence } from "./types";

export type CommitResolver = (options: {
  readonly timestamp: number;
}) => Promise<string | null>;

export function resolveCommitReference(options: {
  readonly token: string;
  readonly commits: ReadonlySet<string>;
}): string | null {
  const token = options.token.toLowerCase();
  if (options.commits.has(token)) {
    return token;
  }

  const prefixed = [...options.commits].filter((commit) =>
    commit.startsWith(token),
  );
  const [only] = prefixed;

  return prefixed.length === 1 && only ? only : null;
}

export async function resolveStartingCommit(options: {
  readonly candidate: Evidence;
  readonly commits: ReadonlySet<string>;
  readonly resolveCommit?: CommitResolver;
}): Promise<string | null> {
  const named = options.candidate.text
    .split(/[^a-fA-F0-9]+/)
    .flatMap((token) => {
      const resolved =
        token.length >= 7
          ? resolveCommitReference({ token, commits: options.commits })
          : null;
      return resolved ? [resolved] : [];
    });

  const [first] = named;
  if (first) {
    return first;
  }

  if (!options.resolveCommit) {
    return null;
  }

  const dated = await options.resolveCommit({
    timestamp: options.candidate.timestamp,
  });

  return dated
    ? resolveCommitReference({ token: dated, commits: options.commits })
    : null;
}
