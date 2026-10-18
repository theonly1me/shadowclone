import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Processes } from "../run/processes";
import type { ClonesPaths } from "../config/store";

export type ServiceDefinition = {
  readonly label: string;
  readonly unit: string;
  readonly description: string;
  readonly command: readonly string[];
  readonly log: string;
};

export function cloneServeService(paths: ClonesPaths): ServiceDefinition {
  return {
    label: "dev.shadowclone.sessions",
    unit: "shadowclone-sessions.service",
    description: "shadowclone clones",
    command: ["serve"],
    log: path.join(paths.logsDirectory, "serve.log"),
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function systemdQuoted(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function launchdPlist(options: {
  readonly service: ServiceDefinition;
  readonly executable: string;
  readonly pathVariable: string;
}): string {
  const { service } = options;
  const programArguments = [options.executable, ...service.command]
    .map((argument) => `<string>${escapeXml(argument)}</string>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${escapeXml(service.label)}</string>
  <key>ProgramArguments</key><array>${programArguments}</array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${escapeXml(options.pathVariable)}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${escapeXml(service.log)}</string>
  <key>StandardErrorPath</key><string>${escapeXml(service.log)}</string>
</dict>
</plist>
`;
}

export function systemdUnit(options: {
  readonly service: ServiceDefinition;
  readonly executable: string;
  readonly pathVariable: string;
}): string {
  const { service } = options;

  return `[Unit]
Description=${service.description}
After=network-online.target

[Service]
ExecStart=${[options.executable, ...service.command].map(systemdQuoted).join(" ")}
Environment=${systemdQuoted(`PATH=${options.pathVariable}`)}
Restart=always
RestartSec=30

[Install]
WantedBy=default.target
`;
}

export type ServiceOutcome =
  | { readonly kind: "installed"; readonly file: string; readonly warnings: readonly string[] }
  | { readonly kind: "failed"; readonly file: string; readonly detail: string }
  | { readonly kind: "unsupported"; readonly platform: string };

export async function installService(options: {
  readonly service: ServiceDefinition;
  readonly processes: Processes;
  readonly executable: string;
  readonly pathVariable: string;
  readonly platform?: NodeJS.Platform;
  readonly home?: string;
}): Promise<ServiceOutcome> {
  const { service } = options;
  const platform = options.platform ?? process.platform;
  const home = options.home ?? os.homedir();
  const run = (command: readonly string[]) =>
    options.processes.run({ arguments: command, cwd: home });

  if (platform === "darwin") {
    const file = path.join(home, "Library", "LaunchAgents", `${service.label}.plist`);
    const domain = `gui/${process.getuid?.() ?? 0}`;

    await mkdir(path.dirname(file), { recursive: true });
    await mkdir(path.dirname(service.log), { recursive: true, mode: 0o700 });
    await writeFile(file, launchdPlist(options));
    await run(["launchctl", "bootout", domain, file]);

    const started = await run(["launchctl", "bootstrap", domain, file]);

    return started.exitCode === 0
      ? { kind: "installed", file, warnings: [] }
      : { kind: "failed", file, detail: started.stderr.trim() };
  }

  if (platform === "linux") {
    const file = path.join(home, ".config", "systemd", "user", service.unit);

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, systemdUnit(options));
    await run(["systemctl", "--user", "daemon-reload"]);

    const started = await run(["systemctl", "--user", "enable", "--now", service.unit]);

    if (started.exitCode !== 0) {
      return { kind: "failed", file, detail: started.stderr.trim() };
    }

    await run(["systemctl", "--user", "restart", service.unit]);

    const linger = await run(["loginctl", "enable-linger"]);
    const warnings =
      linger.exitCode === 0
        ? []
        : [
            "The service stops when you sign out. Run sudo loginctl enable-linger with your user name to keep it running.",
          ];

    return { kind: "installed", file, warnings };
  }

  return { kind: "unsupported", platform };
}
