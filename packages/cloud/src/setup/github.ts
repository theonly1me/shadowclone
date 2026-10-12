export type GithubApi = (options: {
  readonly route: string;
  readonly token?: string;
  readonly body?: unknown;
}) => Promise<unknown>;

export type GhCommand = (options: {
  readonly arguments: readonly string[];
  readonly input?: string;
}) => Promise<string>;

export const runGh: GhCommand = async (options) => {
  const executable = Bun.which("gh");

  if (!executable) {
    throw new Error("Install GitHub CLI and run gh auth login before setup.");
  }

  const child = Bun.spawn([executable, ...options.arguments], {
    stdin: options.input === undefined ? "ignore" : new Blob([options.input]),
    stdout: "pipe",
    stderr: "ignore",
  });
  const output = await new Response(child.stdout).text();

  if ((await child.exited) !== 0) {
    throw new Error(
      "GitHub CLI could not complete setup. Check gh auth status and repository " +
        "administration access.",
    );
  }

  return output;
};
