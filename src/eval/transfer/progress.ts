import type { EvaluationProgress } from "./types";

function elapsedTime(options: {
  readonly startedAt: number;
  readonly now: number;
}): string {
  const totalSeconds = Math.max(
    0,
    Math.floor((options.now - options.startedAt) / 1000),
  );
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function progressDescription(progress: EvaluationProgress): string {
  if (progress.stage === "ready") {
    return "Evaluation prepared";
  }
  if (progress.stage === "complete") {
    return "Evaluation complete";
  }
  if (progress.stage === "error") {
    return "Evaluation stopped on an infrastructure error";
  }
  if (progress.stage === "timeout") {
    return "Evaluation stopped at its wall-clock limit";
  }
  const task = `Task ${progress.taskIndex}/${progress.taskCount}`;
  const repeat = `repeat ${progress.repeatIndex}/${progress.repeatCount}`;
  if (progress.stage === "judging") {
    return `${task}, ${repeat}: blind judge vote ${progress.voteIndex}/${progress.voteCount}`;
  }
  return `${task}, ${repeat}, ${progress.arm}: ${progress.stage}`;
}

export function progressLine(options: {
  readonly progress: EvaluationProgress;
  readonly startedAt: number;
  readonly now?: number;
}): string {
  const elapsed = elapsedTime({
    startedAt: options.startedAt,
    now: options.now ?? Date.now(),
  });
  return `[${elapsed}] ${progressDescription(options.progress)}`;
}

export function stepLine(options: {
  readonly message: string;
  readonly startedAt: number;
  readonly now?: number;
}): string {
  const elapsed = elapsedTime({
    startedAt: options.startedAt,
    now: options.now ?? Date.now(),
  });
  return `[${elapsed}] ${options.message}`;
}
