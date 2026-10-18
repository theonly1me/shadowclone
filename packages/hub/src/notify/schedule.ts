import type { CloneNode } from "@shadowclone/clones";
import type { LiveSessions } from "@shadowclone/live";
import type { NodeLinks } from "../fleet/links";
import type { HubStore } from "../store";
import { gatherStates } from "./gather";
import { sendNtfy } from "./push";
import { createWatcher } from "./watcher";

const scanMilliseconds = 15_000;

export function watchSessions(options: {
  readonly store: HubStore;
  readonly node: CloneNode;
  readonly live?: LiveSessions | undefined;
  readonly links: NodeLinks;
  readonly hostName: string;
  readonly log: (line: string) => void;
}): { readonly stop: () => void } {
  const watcher = createWatcher({
    gather: () => gatherStates(options),
    settings: () => options.store.settings(),
    send: ({ url, push }) => sendNtfy({ url, push }),
    log: options.log,
  });
  let scanning = false;
  const scan = () => {
    if (scanning) {
      return;
    }

    scanning = true;
    watcher
      .scan()
      .catch((error: unknown) => {
        options.log(
          `The session watch failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      })
      .finally(() => {
        scanning = false;
      });
  };
  const timer = setInterval(scan, scanMilliseconds);

  scan();

  return { stop: () => clearInterval(timer) };
}
