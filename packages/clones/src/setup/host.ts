import type { Processes } from "../run/processes";
import type { SessionConfig } from "../session/config";
import type { ClonesPaths } from "../session/store";
import { codexLoginArguments, dockerRunArguments } from "../serve/docker";
import { checkLineSchema, type CheckLine } from "./check";

export function parseCheckLine(text: string): CheckLine | null {
  try {
    const parsed = checkLineSchema.safeParse(JSON.parse(text));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function checkSessionHost(options: {
  readonly config: SessionConfig;
  readonly paths: ClonesPaths;
  readonly processes: Processes;
}): Promise<readonly CheckLine[]> {
  const result = await options.processes.run({
    arguments: dockerRunArguments({
      config: options.config,
      paths: options.paths,
      name: `shadowclone-check-${Date.now()}`,
      command: ["shadowclone", "session", "check"],
      environment: { SHADOWCLONE_SESSION_CONFIG: JSON.stringify(options.config) },
    }),
    cwd: options.paths.directory,
  });
  const lines = result.stdout.split("\n").flatMap((line) => parseCheckLine(line) ?? []);

  return lines.length > 0
    ? lines
    : [
        {
          name: "Clone image",
          passed: false,
          detail: `The check container exited with code ${result.exitCode}: ${result.stderr.trim().slice(0, 300)}`,
        },
      ];
}

export function chatgptLoginArguments(config: SessionConfig): readonly string[] {
  return [
    "docker",
    "run",
    "--rm",
    ...codexLoginArguments(config),
    config.image,
    "sh",
    "-c",
    'mkdir -p "$SHADOWCLONE_CODEX_LOGIN_HOME" && printf \'cli_auth_credentials_store = "file"\\n\' > "$SHADOWCLONE_CODEX_LOGIN_HOME/config.toml" && CODEX_HOME="$SHADOWCLONE_CODEX_LOGIN_HOME" codex login --device-auth',
  ];
}
