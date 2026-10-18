import type { EngineProcess } from "../processes";

export type FakeEngine = {
  readonly engine: EngineProcess;
  readonly written: unknown[];
  readonly emit: (value: unknown) => void;
  readonly writes: (count: number) => Promise<void>;
};

export function fakeEngine(
  options: { readonly onWrite?: (value: unknown, emit: (value: unknown) => void) => void } = {},
): FakeEngine {
  const written: unknown[] = [];
  const queued: string[] = [];
  const readers: ((line: IteratorResult<string>) => void)[] = [];
  let closed = false;
  let exit: (code: number) => void = () => undefined;
  const exited = new Promise<number>((resolve) => {
    exit = resolve;
  });
  const emit = (value: unknown) => {
    const line = JSON.stringify(value);
    const reader = readers.shift();

    if (reader === undefined) {
      queued.push(line);
    } else {
      reader({ value: line, done: false });
    }
  };
  const close = () => {
    closed = true;

    for (const reader of readers.splice(0)) {
      reader({ value: undefined, done: true });
    }

    exit(0);
  };
  const lines: AsyncIterable<string> = {
    [Symbol.asyncIterator]: () => ({
      next: () => {
        const [first] = queued.splice(0, 1);

        if (first !== undefined) {
          return Promise.resolve({ value: first, done: false });
        }

        return closed
          ? Promise.resolve({ value: undefined, done: true })
          : new Promise<IteratorResult<string>>((resolve) => readers.push(resolve));
      },
    }),
  };

  return {
    engine: {
      write: (line) => {
        const value: unknown = JSON.parse(line);

        written.push(value);
        options.onWrite?.(value, emit);
      },
      end: close,
      lines,
      exited,
      terminate: close,
      tail: () => "",
    },
    written,
    emit,
    writes: async (count) => {
      for (let attempt = 0; attempt < 400 && written.length < count; attempt++) {
        await Bun.sleep(1);
      }
    },
  };
}
