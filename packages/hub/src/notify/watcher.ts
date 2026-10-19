import { finalStates, pushFor, type Push } from "./push";
import type { NodeStates, SessionState } from "./states";

function keysOf(state: SessionState): readonly string[] {
  return [
    ...(state.needsYou ? [`${state.id}/needs/${state.questionId ?? "-"}`] : []),
    ...(state.kind === "clone" && finalStates.includes(state.state)
      ? [`${state.id}/${state.state}`]
      : []),
  ];
}

export const pushAttempts = 240;

export type Watcher = { readonly scan: () => Promise<void> };

type Due = { readonly key: string; readonly node: string; readonly push: Push };

type Unsent = Map<string, { readonly node: string; readonly attempts: number }>;

function forgetEnded(options: {
  readonly unsent: Unsent;
  readonly due: readonly Due[];
  readonly reached: readonly NodeStates[];
}): void {
  const dueKeys = new Set(options.due.map((entry) => entry.key));
  const reachedNodes = new Set(options.reached.map((entry) => entry.node));

  for (const [key, entry] of options.unsent) {
    if (reachedNodes.has(entry.node) && !dueKeys.has(key)) {
      options.unsent.delete(key);
    }
  }
}

export function createWatcher(options: {
  readonly gather: () => Promise<readonly NodeStates[]>;
  readonly settings: () => { readonly notifyUrl: string | null; readonly notifyText: boolean };
  readonly send: (options: { readonly url: string; readonly push: Push }) => Promise<void>;
  readonly log: (line: string) => void;
}): Watcher {
  const seen = new Map<string, ReadonlySet<string>>();
  const unsent: Unsent = new Map();
  let seeded = false;

  const failed = (failure: { readonly entry: Due; readonly error: unknown }) => {
    const { entry } = failure;
    const attempts = (unsent.get(entry.key)?.attempts ?? 0) + 1;
    const reason = failure.error instanceof Error ? failure.error.message : String(failure.error);

    if (attempts >= pushAttempts) {
      unsent.delete(entry.key);
      options.log(`The hub stopped trying to push "${entry.push.title}" after ${pushAttempts} tries.`);

      return;
    }

    unsent.set(entry.key, { node: entry.node, attempts });

    if (attempts === 1) {
      options.log(`A push failed, and the hub tries it again at each scan: ${reason}`);
    }
  };

  return {
    scan: async () => {
      const { notifyUrl, notifyText } = options.settings();
      const reached = await options.gather();
      const due: Due[] = [];

      for (const { node, states } of reached) {
        const earlier = seen.get(node);
        const keys = new Set<string>();

        for (const state of states) {
          for (const key of keysOf(state)) {
            const unsentKey = `${node}/${key}`;

            keys.add(key);

            if (unsent.has(unsentKey) || (seeded && earlier !== undefined && !earlier.has(key))) {
              due.push({ key: unsentKey, node, push: pushFor({ node, state, withText: notifyText }) });
            }
          }
        }

        seen.set(node, keys);
      }

      seeded = true;
      forgetEnded({ unsent, due, reached });

      if (notifyUrl === null) {
        unsent.clear();

        return;
      }

      for (const entry of due) {
        await options.send({ url: notifyUrl, push: entry.push }).then(
          () => unsent.delete(entry.key),
          (error: unknown) => failed({ entry, error }),
        );
      }
    },
  };
}
