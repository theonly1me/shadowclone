import { redactSecrets } from "../../redact";

export async function command(options: {
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly timeoutSeconds?: number;
}): Promise<string> {
  const timeoutMs = (options.timeoutSeconds ?? 60) * 1000;
  const child = Bun.spawn({
    cmd: [...options.arguments],
    cwd: options.cwd,
    stdout: "pipe",
    stderr: "pipe",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

  if (exitCode !== 0) {
    const message = stderr.trim() || "Evaluation command failed";
    throw new Error(redactSecrets({ text: message }));
  }

  return stdout.trim();
}
