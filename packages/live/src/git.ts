export type GitFacts = { readonly repository: string | null; readonly branch: string | null };

export function repositoryFromRemote(url: string): string | null {
  const match = /[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(url.trim());

  return match?.[1] === undefined || match[2] === undefined ? null : `${match[1]}/${match[2]}`;
}

async function gitOutput(options: {
  readonly cwd: string;
  readonly arguments: readonly string[];
}): Promise<string | null> {
  try {
    const child = Bun.spawn(["git", "-C", options.cwd, ...options.arguments], {
      stdout: "pipe",
      stderr: "ignore",
      stdin: "ignore",
      timeout: 2000,
    });
    const [text, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited]);

    return exitCode === 0 && text.trim() !== "" ? text.trim() : null;
  } catch {
    return null;
  }
}

export async function readGitFacts(cwd: string): Promise<GitFacts> {
  const [remote, branch] = await Promise.all([
    gitOutput({ cwd, arguments: ["remote", "get-url", "origin"] }),
    gitOutput({ cwd, arguments: ["branch", "--show-current"] }),
  ]);

  return { repository: remote === null ? null : repositoryFromRemote(remote), branch };
}
