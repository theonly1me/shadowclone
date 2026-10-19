import { inboxEntrySchema, type InboxEntry } from "../../node/inbox";
import type { AskedQuestion, Progress } from "../../node/progress";
import { readAskedQuestions } from "../ask/questions";
import { answerText, noAnswerText, ownerMessageText } from "./messages";
import type { EngineDriver, TurnEnd } from "./turns";

export const answerWaitMilliseconds = 30 * 60_000;

export type Supervision = {
  readonly outcome: TurnEnd["outcome"] | "stopped";
  readonly summary: string;
  readonly exitCode: number;
};

type Wake = "delivered" | "timeout" | "stopped";

function parseEntry(line: string): InboxEntry | null {
  try {
    const parsed = inboxEntrySchema.safeParse(JSON.parse(line));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function superviseEngine(options: {
  readonly driver: EngineDriver;
  readonly inbox: AsyncIterable<string>;
  readonly questionsFile: string;
  readonly report: (progress: Progress) => void;
  readonly base: Pick<Progress, "branch" | "engine">;
  readonly signal: AbortSignal;
  readonly waitMilliseconds?: number;
  readonly pollMilliseconds?: number;
}): Promise<Supervision> {
  const { driver, report, base, signal } = options;
  const open = new Map<string, AskedQuestion>();
  const seen = new Set<string>();
  const waiter: { wake: ((reason: Wake) => void) | null } = { wake: null };

  const pollQuestions = async () => {
    for (const question of await readAskedQuestions(options.questionsFile)) {
      if (!seen.has(question.id)) {
        seen.add(question.id);
        open.set(question.id, question);
        report({
          ...base,
          state: "working",
          question,
          detail: `The clone asked: ${question.text}`.slice(0, 2000),
        });
      }
    }
  };
  const poller = setInterval(() => {
    pollQuestions().catch(() => undefined);
  }, options.pollMilliseconds ?? 1000);

  (async () => {
    for await (const line of options.inbox) {
      const entry = parseEntry(line);

      if (entry === null) {
        continue;
      }

      if (entry.kind === "message") {
        await driver.send(ownerMessageText(entry.text));
      } else {
        await pollQuestions();

        const question = open.get(entry.question);

        open.delete(entry.question);
        await driver.send(
          answerText({ question: question?.text ?? entry.question, answer: entry.text }),
        );
      }

      report({
        ...base,
        state: "working",
        detail:
          entry.kind === "message"
            ? "The clone received your message."
            : "The clone received your answer.",
      });
      waiter.wake?.("delivered");
    }
  })().catch(() => undefined);

  const stopped = new Promise<"stopped">((resolve) => {
    if (signal.aborted) {
      resolve("stopped");
    }

    signal.addEventListener("abort", () => resolve("stopped"), { once: true });
  });
  const waitForOwner = () =>
    new Promise<Wake>((resolve) => {
      const timer = setTimeout(
        () => resolve("timeout"),
        options.waitMilliseconds ?? answerWaitMilliseconds,
      );

      waiter.wake = (reason) => {
        clearTimeout(timer);
        resolve(reason);
      };
      stopped.then(() => waiter.wake?.("stopped")).catch(() => undefined);
    });

  let outcome: Supervision["outcome"] = "failed";
  let summary = "";

  try {
    while (true) {
      const end = await Promise.race([driver.nextTurnEnd(), stopped]);

      if (end === "stopped") {
        outcome = "stopped";
        break;
      }

      outcome = end.outcome;
      summary = end.summary;
      await pollQuestions();

      if (end.outcome === "failed" || (!driver.busy() && open.size === 0)) {
        break;
      }

      if (driver.busy()) {
        continue;
      }

      report({
        ...base,
        state: "waiting",
        detail: `The clone waits up to 30 minutes for your answer to ${open.size} question${open.size === 1 ? "" : "s"}.`,
      });

      const reason = await waitForOwner();

      waiter.wake = null;

      if (reason === "stopped") {
        outcome = "stopped";
        break;
      }

      if (reason === "timeout") {
        const expired = [...open.keys()];

        open.clear();
        report({
          ...base,
          state: "working",
          expired,
          detail:
            "No answer arrived. The clone takes its recommended options and skips each destructive step.",
        });
        await driver.send(noAnswerText);
      }
    }
  } finally {
    clearInterval(poller);
  }

  return { outcome, summary, exitCode: await driver.close() };
}
