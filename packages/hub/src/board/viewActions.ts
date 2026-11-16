import type { BoardActions } from "./view/state";

type Sent = { readonly id: string; readonly text: string };

type Answered = { readonly id: string; readonly question: string; readonly text: string };

export function recordingActions(): {
  readonly actions: BoardActions;
  readonly sent: Sent[];
  readonly answered: Answered[];
} {
  const sent: Sent[] = [];
  const answered: Answered[] = [];
  const ignore = () => undefined;

  return {
    sent,
    answered,
    actions: {
      refresh: ignore,
      open: ignore,
      send: (entry) => sent.push(entry),
      answer: (entry) => answered.push(entry),
      startPairing: ignore,
      cancelPairing: ignore,
      choose: ignore,
      unpair: ignore,
      fullscreen: ignore,
    },
  };
}
