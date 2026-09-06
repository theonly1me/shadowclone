import {
  prepareCandidateTask,
  type CommitResolver,
} from "./prepareCandidate";
import type { DelegationTask, Evidence, ModelCall } from "./types";

export type { CommitResolver } from "./prepareCandidate";

export async function prepareTasks(options: {
  readonly evidence: readonly Evidence[];
  readonly commits: ReadonlySet<string>;
  readonly count: number;
  readonly since: number;
  readonly call: ModelCall;
  readonly cwd: string;
  readonly resolveCommit?: CommitResolver;
  readonly learnProfile?: (options: {
    readonly training: readonly Evidence[];
    readonly cutoff: number;
  }) => Promise<string>;
}): Promise<{
  readonly tasks: readonly DelegationTask[];
  readonly exclusions: readonly {
    readonly sessionId: string;
    readonly reason: string;
  }[];
}> {
  const tasks: DelegationTask[] = [];
  const exclusions: { sessionId: string; reason: string }[] = [];

  const groupedSessions = Map.groupBy(
    options.evidence,
    (entry) => entry.sessionId,
  );

  const candidates = [...groupedSessions.values()]
    .flatMap((entries) => (entries[0] ? [entries[0]] : []))
    .filter((entry) => entry.timestamp >= options.since)
    .slice(-options.count * 4);

  for (const candidate of candidates) {
    if (tasks.length >= options.count) {
      break;
    }

    const result = await prepareCandidateTask({
      candidate,
      evidence: options.evidence,
      commits: options.commits,
      call: options.call,
      cwd: options.cwd,
      resolveCommit: options.resolveCommit,
      learnProfile: options.learnProfile,
    });

    if (result.exclusion) {
      exclusions.push(result.exclusion);
      continue;
    }

    if (result.task) {
      tasks.push(result.task);
    }
  }

  return { tasks, exclusions };
}
