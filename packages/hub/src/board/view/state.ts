import type { FleetBoard } from "../schema";
import type { Notice, SessionDetail } from "./model";

export type ViewState = {
  board: FleetBoard | null;
  opened: string | null;
  pairingFirst: string | null;
  pairing: boolean;
  busy: boolean;
  fullscreen: boolean;
  canFullscreen: boolean;
  readonly details: Map<string, SessionDetail>;
  readonly notices: Map<string, Notice>;
  readonly drafts: Map<string, string>;
};

export const boardNoticeKey = "board";

export const pairsNoticeKey = "pairs";

export function emptyState(): ViewState {
  return {
    board: null,
    opened: null,
    pairingFirst: null,
    pairing: false,
    busy: false,
    fullscreen: false,
    canFullscreen: false,
    details: new Map(),
    notices: new Map(),
    drafts: new Map(),
  };
}

export type BoardActions = {
  readonly refresh: () => void;
  readonly open: (id: string) => void;
  readonly send: (options: { readonly id: string; readonly text: string }) => void;
  readonly startPairing: () => void;
  readonly cancelPairing: () => void;
  readonly choose: (id: string) => void;
  readonly unpair: (pair: string) => void;
  readonly fullscreen: () => void;
};
