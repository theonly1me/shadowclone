import type { ReviewHunk } from "./hunks";

export type ReviewLens = {
  readonly id: "authorization" | "transactions" | "side-effects" | "compatibility";
  readonly title: string;
  readonly focus: string;
  readonly lineTrigger: RegExp;
  readonly pathTrigger: RegExp;
};

export type LensAssignment = {
  readonly lens: ReviewLens;
  readonly hunks: readonly ReviewHunk[];
};

export const reviewLenses: readonly ReviewLens[] = [
  {
    id: "authorization",
    title: "Authorization",
    focus:
      "Find a caller that can reach data or an action that it does not own. Check each new endpoint, mutation, query, and job for an ownership or role check on the server. Check organization and tenant filters on reads and writes, ids that come from the client, admin-only paths, and a check that runs after its effect.",
    lineTrigger: /\b(?:auth|permission|role|admin|owner|tenant|organi[sz]ation|workspace|session|token|access|capabilit|polic|guard|actor|forbidden)/i,
    pathTrigger: /(?:auth|permission|polic|guard|middleware|router|controller|resolver|\/api\/)/i,
  },
  {
    id: "transactions",
    title: "Transactions and concurrency",
    focus:
      "Find a state change that two requests, retries, or workers can interleave. Check a read and a later write without a lock or a unique constraint, a check outside the transaction that guards a write inside it, shared state in parallel work, a retry that repeats an effect, and locks taken in different orders.",
    lineTrigger: /(?:transaction|\block|for update|upsert|unique|retr(?:y|ies)|concurren|\brace\b|mutex|semaphore|atomic|idempoten|\bqueue|worker|Promise\.all)/i,
    pathTrigger: /(?:reducer|repositor|migration|queue|worker|\bjobs?\b|cron|lock)/i,
  },
  {
    id: "side-effects",
    title: "Outside side effects",
    focus:
      "Find a call to another system that can happen twice, happen without the local record, or leave the local record without the call. Check payment, email, webhook, queue, storage, and outside API calls for idempotency, clean-up after a failure, order relative to the database commit, timeouts, and error handling.",
    lineTrigger: /(?:fetch\(|axios|\brequest\(|stripe|metronome|webhook|e-?mail|notif|publish|enqueue|\bsend\w*\(|upload|\bs3\b|bucket|charge|refund|invoice|slack|exec\(|spawn\(|child_process|\b(?:create|delete|update)Customer)/i,
    pathTrigger: /(?:gateway|client|integration|webhook|email|notification|payment|billing)/i,
  },
  {
    id: "compatibility",
    title: "Compatibility",
    focus:
      "Find stored data or callers that the change breaks. Check renamed or removed exports, fields, enum values, and routes. Check schema and migration changes against existing rows and against older code during a rolling deploy. Check changed defaults and serialized data that older readers parse.",
    lineTrigger: /(?:z\.(?:object|enum)\(|\benum\b|ALTER\s+TABLE|DROP\s|RENAME|ADD\s+COLUMN|@deprecated|\bschema\b)/i,
    pathTrigger: /(?:migration|\.prisma$|\.sql$|schema|openapi|\.proto$|graphql|\/api\/|router|routes|types\.ts$)/i,
  },
];

function touchesLens(options: { readonly lens: ReviewLens; readonly hunk: ReviewHunk }): boolean {
  const { lens, hunk } = options;

  return lens.pathTrigger.test(hunk.path) || hunk.added.some((line) => lens.lineTrigger.test(line));
}

export function lensAssignments(hunks: readonly ReviewHunk[]): readonly LensAssignment[] {
  return reviewLenses.flatMap((lens) => {
    const matched = hunks.filter((hunk) => touchesLens({ lens, hunk }));

    return matched.length > 0 ? [{ lens, hunks: matched }] : [];
  });
}
