export type ProcessResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export type ProcessRequest = {
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly environment?: Readonly<Record<string, string>>;
  readonly input?: string;
};

export type Processes = {
  readonly run: (options: ProcessRequest) => Promise<ProcessResult>;
  readonly stream: (options: ProcessRequest & { readonly signal: AbortSignal }) => Promise<{
    readonly exitCode: number;
    readonly tail: string;
  }>;
};

const tailBytes = 64 * 1024;

async function relay(options: {
  readonly stream: ReadableStream<Uint8Array>;
  readonly sink: NodeJS.WriteStream;
  readonly tail: string[];
}): Promise<void> {
  const decoder = new TextDecoder();

  for await (const chunk of options.stream) {
    options.sink.write(chunk);
    options.tail.push(decoder.decode(chunk, { stream: true }));

    while (options.tail.join("").length > tailBytes && options.tail.length > 1) {
      options.tail.shift();
    }
  }
}

function spawnRequest(options: ProcessRequest) {
  return Bun.spawn({
    cmd: [...options.arguments],
    cwd: options.cwd,
    env: { ...process.env, ...options.environment },
    stdin: options.input === undefined ? "ignore" : new Blob([options.input]),
    stdout: "pipe",
    stderr: "pipe",
    detached: true,
  });
}

export const hostProcesses: Processes = {
  run: async (options) => {
    const child = spawnRequest(options);
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    return { exitCode, stdout, stderr };
  },
  stream: async (options) => {
    const child = spawnRequest(options);
    const tail: string[] = [];
    const terminate = () => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    };

    options.signal.addEventListener("abort", terminate, { once: true });

    if (options.signal.aborted) {
      terminate();
    }

    try {
      await Promise.all([
        relay({ stream: child.stdout, sink: process.stdout, tail }),
        relay({ stream: child.stderr, sink: process.stderr, tail }),
      ]);

      return { exitCode: await child.exited, tail: tail.join("") };
    } finally {
      options.signal.removeEventListener("abort", terminate);
    }
  },
};

export async function mustRun(
  options: { readonly processes: Processes } & ProcessRequest,
): Promise<string> {
  const { processes, ...request } = options;
  const result = await processes.run(request);

  if (result.exitCode !== 0) {
    throw new Error(
      `${request.arguments.slice(0, 2).join(" ")} failed with exit code ${result.exitCode}: ${result.stderr.trim().slice(0, 500)}`,
    );
  }

  return result.stdout;
}
