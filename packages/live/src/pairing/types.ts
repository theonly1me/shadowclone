import type { LiveDelivery } from "../delivery";
import type { LivePaths } from "../paths";
import type { TypeText } from "../terminal";

export type Refused = { readonly kind: "refused"; readonly reason: string };

export type PairingContext = {
  readonly paths: LivePaths;
  readonly enabled: () => Promise<boolean>;
  readonly typeText: TypeText;
  readonly now: () => Date;
};

export type LivePairView = {
  readonly id: string;
  readonly sessions: readonly [string, string];
  readonly sent: number;
  readonly createdAt: string;
};

export type LivePairOutcome =
  | {
      readonly kind: "paired";
      readonly pair: string;
      readonly deliveries: readonly { readonly session: string; readonly delivery: LiveDelivery }[];
    }
  | Refused;

export type LiveUnpairOutcome = { readonly kind: "unpaired"; readonly pair: string } | Refused;

export type LivePeerOutcome =
  | {
      readonly kind: "sent";
      readonly to: string;
      readonly left: number;
      readonly delivery: LiveDelivery;
    }
  | Refused;

export type LivePairing = {
  readonly pair: (options: {
    readonly first: string;
    readonly second: string;
  }) => Promise<LivePairOutcome>;
  readonly unpair: (pair: string) => Promise<LiveUnpairOutcome>;
  readonly pairs: () => Promise<readonly LivePairView[]>;
  readonly peerSend: (options: {
    readonly key: string;
    readonly text: string;
  }) => Promise<LivePeerOutcome>;
};
