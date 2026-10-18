export type TurnEnd = {
  readonly outcome: "completed" | "failed";
  readonly summary: string;
};

export type EngineDriver = {
  readonly send: (text: string) => Promise<void>;
  readonly nextTurnEnd: () => Promise<TurnEnd>;
  readonly busy: () => boolean;
  readonly close: () => Promise<number>;
};

export type TurnQueue = {
  readonly push: (end: TurnEnd) => void;
  readonly next: () => Promise<TurnEnd>;
};

export function turnQueue(): TurnQueue {
  const ended: TurnEnd[] = [];
  const waiting: ((end: TurnEnd) => void)[] = [];

  return {
    push: (end) => {
      const waiter = waiting.shift();

      if (waiter === undefined) {
        ended.push(end);
      } else {
        waiter(end);
      }
    },
    next: () => {
      const [first, ...rest] = ended;

      if (first !== undefined) {
        ended.splice(0, ended.length, ...rest);

        return Promise.resolve(first);
      }

      return new Promise<TurnEnd>((resolve) => waiting.push(resolve));
    },
  };
}

export const engineExitedEnd: TurnEnd = {
  outcome: "failed",
  summary: "The engine exited before the turn finished.",
};

export async function closeEngine(options: {
  readonly end: () => void;
  readonly terminate: () => void;
  readonly exited: Promise<number>;
  readonly graceMilliseconds: number;
}): Promise<number> {
  options.end();

  const timer = setTimeout(options.terminate, options.graceMilliseconds);

  try {
    return await options.exited;
  } finally {
    clearTimeout(timer);
  }
}
