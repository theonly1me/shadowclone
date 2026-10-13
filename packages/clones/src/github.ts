export type GithubResponse = {
  readonly status: number;
  readonly data: unknown;
};

export type GithubCall = (options: {
  readonly method?: string;
  readonly route: string;
  readonly body?: unknown;
}) => Promise<GithubResponse>;

function splitResponse(output: string): GithubResponse {
  const separator = /\r?\n\r?\n/.exec(output);
  const head = separator === null ? output : output.slice(0, separator.index);
  const body = separator === null ? "" : output.slice(separator.index + separator[0].length).trim();
  const status = Number(/^HTTP\/[\d.]+ (\d{3})/.exec(head)?.[1] ?? 0);

  if (status === 0) {
    throw new Error("GitHub CLI could not reach GitHub. Check gh auth status.");
  }

  return { status, data: body.length > 0 ? JSON.parse(body) : null };
}

export const githubThroughGh: GithubCall = async (options) => {
  const executable = Bun.which("gh");

  if (!executable) {
    throw new Error("Install GitHub CLI and run gh auth login.");
  }

  const child = Bun.spawn(
    [
      executable,
      "api",
      "--include",
      "--method",
      options.method ?? "GET",
      options.route,
      ...(options.body === undefined ? [] : ["--input", "-"]),
    ],
    {
      stdin: options.body === undefined ? "ignore" : new Blob([JSON.stringify(options.body)]),
      stdout: "pipe",
      stderr: "ignore",
    },
  );
  const output = await new Response(child.stdout).text();

  await child.exited;

  return splitResponse(output);
};

export async function githubData(options: {
  readonly github: GithubCall;
  readonly method?: string;
  readonly route: string;
  readonly body?: unknown;
}): Promise<unknown> {
  const { github, ...request } = options;
  const response = await github(request);

  if (response.status >= 300) {
    throw new Error(
      `GitHub refused ${request.method ?? "GET"} ${request.route} (${response.status}).`,
    );
  }

  return response.data;
}
