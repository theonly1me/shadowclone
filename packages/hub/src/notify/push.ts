import { redactSecrets } from "@shadowclone/redact";
import type { FetchCall } from "../fleet/protocol";
import type { SessionState } from "./states";

export type Push = { readonly title: string; readonly body: string; readonly urgent: boolean };

export const finalStates = ["done", "failed", "limited"];

function label(state: SessionState): string {
  return state.kind === "clone" ? `Clone ${state.id}` : `Live session ${state.id}`;
}

export function pushFor(options: {
  readonly node: string;
  readonly state: SessionState;
  readonly withText: boolean;
}): Push {
  const { node, state, withText } = options;

  if (state.needsYou) {
    const question = redactSecrets({ text: state.question ?? "It waits for you." }).slice(0, 500);

    return {
      title: `${label(state)} needs you`,
      body: withText
        ? `${state.repository} on ${node}: ${question}`
        : `On ${node}. Ask Claude about ${state.id} to see what it needs.`,
      urgent: true,
    };
  }

  return {
    title: `${label(state)} ${state.state}`,
    body: withText
      ? `${state.repository} on ${node}.`
      : `On ${node}. Ask Claude about ${state.id}.`,
    urgent: false,
  };
}

export async function sendNtfy(options: {
  readonly url: string;
  readonly push: Push;
  readonly fetch?: FetchCall;
}): Promise<void> {
  const response = await (options.fetch ?? fetch)(options.url, {
    method: "POST",
    headers: {
      Title: options.push.title,
      Priority: options.push.urgent ? "high" : "default",
      Tags: "shadowclone",
    },
    body: options.push.body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`ntfy answered ${response.status}.`);
  }
}
