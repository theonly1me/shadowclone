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

export type EngineProcess = {
  readonly write: (line: string) => void;
  readonly end: () => void;
  readonly lines: AsyncIterable<string>;
  readonly exited: Promise<number>;
  readonly terminate: () => void;
  readonly tail: () => string;
};

export type Processes = {
  readonly run: (options: ProcessRequest) => Promise<ProcessResult>;
  readonly open: (options: Omit<ProcessRequest, "input">) => EngineProcess;
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

function keepTail(options: { readonly tail: string[]; readonly text: string }): void {
  options.tail.push(options.text);

  while (options.tail.join("").length > tailBytes && options.tail.length > 1) {
    options.tail.shift();
  }
}

async function* outputLines(options: {
  readonly stream: ReadableStream<Uint8Array>;
  readonly tail: string[];
}): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let pending = "";

  for await (const chunk of options.stream) {
    process.stderr.write(chunk);

    const text = decoder.decode(chunk, { stream: true });

    keepTail({ tail: options.tail, text });
    pending += text;

    const lines = pending.split("\n");

    pending = lines.pop() ?? "";
    yield* lines;
  }

  if (pending !== "") {
    yield pending;
  }
}

function openEngine(options: Omit<ProcessRequest, "input">): EngineProcess {
  const child = Bun.spawn({
    cmd: [...options.arguments],
    cwd: options.cwd,
    env: { ...process.env, ...options.environment },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    detached: true,
  });
  const tail: string[] = [];

  relay({ stream: child.stderr, sink: process.stderr, tail }).catch(() => undefined);

  return {
    write: (line) => {
      child.stdin.write(`${line}\n`);
      child.stdin.flush();
    },
    end: () => {
      child.stdin.end();
    },
    lines: outputLines({ stream: child.stdout, tail }),
    exited: child.exited,
    terminate: () => {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill("SIGTERM");
      }
    },
    tail: () => tail.join(""),
  };
}

export const hostProcesses: Processes = {
  open: openEngine,
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
        relay({ stream: child.stdout, sink: process.stderr, tail }),
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
