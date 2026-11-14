import { boundedText } from "./messages";
import type { LivePaths } from "./paths";
import { surfaceFrom, type LiveRecord, type Surface } from "./record";
import {
  claimQuestion,
  createQuestion,
  newLiveQuestionId,
  readQuestion,
  type LiveQuestion,
} from "./questionStore";
import { readRecord, writeRecord } from "./store";

export type QuestionTiming = {
  readonly waitMilliseconds: number;
  readonly pollMilliseconds: number;
  readonly handoffMilliseconds: number;
};

export const questionTiming: QuestionTiming = {
  waitMilliseconds: 50_000,
  pollMilliseconds: 500,
  handoffMilliseconds: 2_000,
};

export type LiveQuestionInput = {
  readonly text: string;
  readonly options: readonly string[];
  readonly recommended: string;
};

export type LiveAskOutcome =
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "answered"; readonly question: LiveQuestion; readonly answer: string }
  | { readonly kind: "expired" | "closed"; readonly question: LiveQuestion };

export type QuestionContext = {
  readonly paths: LivePaths;
  readonly id: string;
  readonly now: () => Date;
  readonly timing: QuestionTiming;
};

export function questionAttention(question: LiveQuestion): string {
  return boundedText({ text: `Question: ${question.text}`, limit: 300 });
}

function sameSurface(options: {
  readonly record: LiveRecord;
  readonly caller: Surface | null;
}): boolean {
  const { record, caller } = options;

  return (
    record.surface === null ||
    caller === null ||
    JSON.stringify(record.surface) === JSON.stringify(caller)
  );
}

export async function setState(
  options: QuestionContext & { readonly change: (record: LiveRecord) => LiveRecord | null },
): Promise<LiveRecord | null> {
  const record = await readRecord(options);
  const changed = record === null ? null : options.change(record);

  if (changed !== null) {
    await writeRecord({
      paths: options.paths,
      record: { ...changed, updatedAt: options.now().toISOString() },
    });
  }

  return changed ?? record;
}

async function waitForAnswer(
  options: QuestionContext & { readonly question: LiveQuestion },
): Promise<LiveAskOutcome> {
  const { question } = options;

  while (options.now().getTime() < Date.parse(question.waitUntil)) {
    await Bun.sleep(options.timing.pollMilliseconds);

    const current = await readQuestion(options);

    if (current?.id !== question.id) {
      return { kind: "closed", question };
    }

    const claimed = current.answer === null ? null : await claimQuestion(options);

    if (claimed !== null && claimed.answer !== null) {
      await setState({
        ...options,
        change: (record) => ({ ...record, state: "working", attention: null }),
      });

      return { kind: "answered", question, answer: claimed.answer };
    }
  }

  return { kind: "expired", question };
}

function markNeedsYou(
  options: QuestionContext & { readonly question: LiveQuestion },
): Promise<LiveRecord | null> {
  return setState({
    ...options,
    change: (current) => ({
      ...current,
      state: "needs-you",
      attention: questionAttention(options.question),
    }),
  });
}

async function refusedSecond(options: QuestionContext): Promise<LiveAskOutcome> {
  const open = await readQuestion(options);

  return {
    kind: "refused",
    reason: `Live session ${options.id} already has an open question${open === null ? "" : ` (${open.id})`}. Wait for its answer.`,
  };
}

export async function askQuestion(
  options: QuestionContext & {
    readonly environment: Readonly<Record<string, string | undefined>>;
    readonly input: LiveQuestionInput;
  },
): Promise<LiveAskOutcome> {
  const record = await readRecord(options);

  if (record === null || record.state === "ended") {
    return {
      kind: "refused",
      reason: `No running live session ${options.id} exists on this machine. Use the id from your session start note.`,
    };
  }

  if (!sameSurface({ record, caller: surfaceFrom(options.environment) })) {
    return {
      kind: "refused",
      reason: `Live session ${options.id} runs in another terminal. Use the id from your session start note.`,
    };
  }

  const bound = (text: string) => boundedText({ text, limit: 200 });
  const asked = options.now();
  const question: LiveQuestion = {
    id: newLiveQuestionId(),
    text: boundedText({ text: options.input.text, limit: 2000 }),
    options: options.input.options.map(bound),
    recommended: bound(options.input.recommended),
    askedAt: asked.toISOString(),
    waitUntil: new Date(asked.getTime() + options.timing.waitMilliseconds).toISOString(),
    answer: null,
  };

  if ((await readQuestion(options)) !== null) {
    return refusedSecond(options);
  }

  await markNeedsYou({ ...options, question });

  if (!(await createQuestion({ ...options, question }))) {
    const open = await readQuestion(options);

    if (open !== null) {
      await markNeedsYou({ ...options, question: open });
    }

    return refusedSecond(options);
  }

  return waitForAnswer({ ...options, question });
}
