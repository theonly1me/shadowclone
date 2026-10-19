import { hostProcesses, installService, type ServiceDefinition } from "@shadowclone/clones";
import { hubPaths, openHub, type HubStore } from "@shadowclone/hub";

export function stopSignal(): AbortSignal {
  const controller = new AbortController();

  process.on("SIGTERM", () => controller.abort());
  process.on("SIGINT", () => controller.abort());

  return controller.signal;
}

export function print(lines: readonly string[]): void {
  console.log(lines.join("\n"));
}

export function timestamped(line: string): void {
  console.log(`${new Date().toISOString()} ${line}`);
}

export async function withStore(run: (store: HubStore) => Promise<void> | void): Promise<void> {
  const store = openHub(hubPaths());

  try {
    await run(store);
  } finally {
    store.close();
  }
}

export async function runAsService(options: {
  readonly service: ServiceDefinition;
  readonly what: string;
}): Promise<void> {
  const outcome = await installService({
    service: options.service,
    processes: hostProcesses,
    executable: Bun.which("shadowclone") ?? "shadowclone",
    pathVariable: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
  });

  if (outcome.kind === "installed") {
    print([`The ${options.what} runs as a service from ${outcome.file}.`, ...outcome.warnings]);

    return;
  }

  print([
    outcome.kind === "failed"
      ? outcome.detail
      : `Services do not support ${outcome.platform}. Run shadowclone ${options.service.command.join(" ")}.`,
  ]);
  process.exitCode = 1;
}
