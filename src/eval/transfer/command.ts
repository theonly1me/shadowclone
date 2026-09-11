import { runHostCommand } from "../../io/hostCommand";
import { redactSecrets } from "../../redact";

export async function command(options: {
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly timeoutSeconds?: number;
}): Promise<string> {
  const { exitCode, stdout, stderr } = await runHostCommand(options);

  if (exitCode !== 0) {
    const message = stderr.trim() || "Evaluation command failed";
    throw new Error(redactSecrets({ text: message }));
  }

  return stdout.trim();
}
