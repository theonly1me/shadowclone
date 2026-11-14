import { deliver, type LiveDelivery } from "./delivery";
import { liveOffReason } from "./messages";
import { localPairing, type LivePairing } from "./pairing";
import type { LivePaths } from "./paths";
import { answerQuestion, type LiveAnswerOutcome } from "./questionAnswer";
import {
  askQuestion,
  questionTiming,
  type LiveAskOutcome,
  type LiveQuestionInput,
  type QuestionTiming,
} from "./questions";
import { readQuestion, type LiveQuestion } from "./questionStore";
import type { LiveRecord } from "./record";
import { listRecords, readRecord } from "./store";
import type { TypeText } from "./terminal";

export type LiveSendOutcome = LiveDelivery | { readonly kind: "refused"; readonly reason: string };

export type LiveSessions = LivePairing & {
  readonly enabled: () => Promise<boolean>;
  readonly list: () => Promise<readonly LiveRecord[]>;
  readonly get: (id: string) => Promise<LiveRecord | null>;
  readonly send: (options: {
    readonly id: string;
    readonly text: string;
  }) => Promise<LiveSendOutcome>;
  readonly question: (id: string) => Promise<LiveQuestion | null>;
  readonly ask: (options: {
    readonly id: string;
    readonly environment: Readonly<Record<string, string | undefined>>;
    readonly input: LiveQuestionInput;
  }) => Promise<LiveAskOutcome>;
  readonly answer: (options: {
    readonly id: string;
    readonly question: string;
    readonly text: string;
  }) => Promise<LiveAnswerOutcome>;
};

const taskBriefsOffReason =
  "shadowclone_ask needs task briefs. The owner can run shadowclone live briefs enable. End your turn with the question instead.";

export function localLive(options: {
  readonly paths: LivePaths;
  readonly enabled: () => Promise<boolean>;
  readonly typeText: TypeText;
  readonly taskBriefs?: () => Promise<boolean>;
  readonly now?: () => Date;
  readonly questionTiming?: QuestionTiming;
}): LiveSessions {
  const now = options.now ?? (() => new Date());
  const { paths } = options;
  const timing = options.questionTiming ?? questionTiming;
  const taskBriefs = options.taskBriefs ?? (async () => false);

  return {
    ...localPairing({ ...options, now }),
    enabled: options.enabled,
    list: async () => ((await options.enabled()) ? listRecords({ paths, now: now() }) : []),
    get: async (id) => ((await options.enabled()) ? readRecord({ paths, id }) : null),
    send: async ({ id, text }) => {
      if (!(await options.enabled())) {
        return { kind: "refused", reason: liveOffReason };
      }

      const record = await readRecord({ paths, id });

      if (record === null) {
        return { kind: "refused", reason: `No live session ${id} exists on this machine.` };
      }

      if (record.state === "ended") {
        return { kind: "refused", reason: `Live session ${id} already ended.` };
      }

      return deliver({
        paths,
        record,
        message: { kind: "owner", text },
        typeText: options.typeText,
        now: now(),
      });
    },
    question: async (id) => ((await options.enabled()) ? readQuestion({ paths, id }) : null),
    ask: async ({ id, environment, input }) => {
      if (!(await options.enabled())) {
        return { kind: "refused", reason: liveOffReason };
      }

      return (await taskBriefs())
        ? askQuestion({ paths, id, now, timing, environment, input })
        : { kind: "refused", reason: taskBriefsOffReason };
    },
    answer: async ({ id, question, text }) =>
      (await options.enabled())
        ? answerQuestion({ paths, id, now, timing, question, text, typeText: options.typeText })
        : { kind: "refused", reason: liveOffReason },
  };
}
