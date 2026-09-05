export type CommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
};

export type CommandRunner = (options: {
  readonly command: readonly string[];
  readonly cwd: string;
}) => Promise<CommandResult>;

export async function runCommand(options: {
  readonly command: readonly string[];
  readonly cwd: string;
}): Promise<CommandResult> {
  const process = Bun.spawn({
    cmd: [...options.command],
    cwd: options.cwd,
    stdout: "pipe",
    stderr: "ignore",
  });
  const [exitCode, stdout] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
  ]);
  return { exitCode, stdout };
}
