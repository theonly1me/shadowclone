import type { Surface } from "./record";

export type RunCommand = (command: readonly string[]) => Promise<number>;

export type TypeText = (options: {
  readonly surface: Surface;
  readonly text: string;
}) => Promise<boolean>;

const macCmux = "/Applications/cmux.app/Contents/Resources/bin/cmux";

export function oneLine(text: string): string {
  return text.replaceAll(/\p{Cc}+/gu, " ").trim();
}

function commandsFor(options: {
  readonly surface: Surface;
  readonly text: string;
}): readonly (readonly string[])[] {
  const { surface, text } = options;

  if (surface.kind === "cmux") {
    const cmux = [
      Bun.which("cmux") ?? macCmux,
      ...(surface.socket === null ? [] : ["--socket", surface.socket]),
    ];

    return [
      [...cmux, "send", "--surface", surface.surface, text],
      [...cmux, "send-key", "--surface", surface.surface, "enter"],
    ];
  }

  const tmux = ["tmux", ...(surface.socket === null ? [] : ["-S", surface.socket])];

  return [
    [...tmux, "send-keys", "-t", surface.pane, "-l", text],
    [...tmux, "send-keys", "-t", surface.pane, "Enter"],
  ];
}

export async function runCommand(command: readonly string[]): Promise<number> {
  try {
    const child = Bun.spawn([...command], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
      timeout: 5000,
    });

    return await child.exited;
  } catch {
    return 127;
  }
}

export function terminalTyper(run: RunCommand = runCommand): TypeText {
  return async ({ surface, text }) => {
    for (const command of commandsFor({ surface, text: oneLine(text) })) {
      if ((await run(command)) !== 0) {
        return false;
      }
    }

    return true;
  };
}
