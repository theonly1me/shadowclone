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

export type Watcher = { readonly scan: () => Promise<void> };

export function createWatcher(options: {
  readonly gather: () => Promise<readonly NodeStates[]>;
  readonly settings: () => { readonly notifyUrl: string | null; readonly notifyText: boolean };
  readonly send: (options: { readonly url: string; readonly push: Push }) => Promise<void>;
  readonly log: (line: string) => void;
}): Watcher {
  const seen = new Map<string, ReadonlySet<string>>();
  let seeded = false;

  return {
    scan: async () => {
      const { notifyUrl, notifyText } = options.settings();
      const pushes: Push[] = [];

      for (const { node, states } of await options.gather()) {
        const earlier = seen.get(node);
        const keys = new Set<string>();

        for (const state of states) {
          for (const key of keysOf(state)) {
            keys.add(key);

            if (seeded && earlier !== undefined && !earlier.has(key)) {
              pushes.push(pushFor({ node, state, withText: notifyText }));
            }
          }
        }

        seen.set(node, keys);
      }

      seeded = true;

      if (notifyUrl === null) {
        return;
      }

      for (const push of pushes) {
        await options.send({ url: notifyUrl, push }).catch((error: unknown) => {
          options.log(`A push failed: ${error instanceof Error ? error.message : String(error)}`);
        });
      }
    },
  };
}
