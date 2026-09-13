import { redactSecrets } from "../../redact";
import {
  evaluationSignal,
  throwIfEvaluationExpired,
} from "./deadline";

export async function command(options: {
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly timeoutSeconds?: number;
}): Promise<string> {
  throwIfEvaluationExpired();
  const timeoutMs = (options.timeoutSeconds ?? 60) * 1000;
  const evaluation = evaluationSignal();
  const child = Bun.spawn({
    cmd: [...options.arguments],
    cwd: options.cwd,
    stdout: "pipe",
    stderr: "pipe",
    signal: evaluation
      ? AbortSignal.any([evaluation, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs),
  });

  let result: [number, string, string];
  try {
    result = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
  } catch (error) {
    throwIfEvaluationExpired();
    throw error;
  }
  const [exitCode, stdout, stderr] = result;
  throwIfEvaluationExpired();

  if (exitCode !== 0) {
    const message = stderr.trim() || "Evaluation command failed";
    throw new Error(redactSecrets({ text: message }));
  }

  return stdout.trim();
}
