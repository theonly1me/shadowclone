import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Processes } from "../run/processes";
import type { ClonesPaths } from "../config/store";

export const serviceLabel = "dev.shadowclone.sessions";

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
  readonly executable: string;
  readonly pathVariable: string;
  readonly log: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${serviceLabel}</string>
  <key>ProgramArguments</key><array><string>${escapeXml(options.executable)}</string><string>serve</string></array>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${escapeXml(options.pathVariable)}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${escapeXml(options.log)}</string>
  <key>StandardErrorPath</key><string>${escapeXml(options.log)}</string>
</dict>
</plist>
`;
}

export function systemdUnit(options: {
  readonly executable: string;
  readonly pathVariable: string;
}): string {
  return `[Unit]
Description=shadowclone clones
After=network-online.target

[Service]
ExecStart=${systemdQuoted(options.executable)} serve
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
  readonly paths: ClonesPaths;
  readonly processes: Processes;
  readonly executable: string;
  readonly pathVariable: string;
  readonly platform?: NodeJS.Platform;
  readonly home?: string;
}): Promise<ServiceOutcome> {
  const platform = options.platform ?? process.platform;
  const home = options.home ?? os.homedir();
  const run = (command: readonly string[]) =>
    options.processes.run({ arguments: command, cwd: home });

  if (platform === "darwin") {
    const file = path.join(home, "Library", "LaunchAgents", `${serviceLabel}.plist`);
    const log = path.join(options.paths.logsDirectory, "serve.log");

    await mkdir(path.dirname(file), { recursive: true });
    await mkdir(options.paths.logsDirectory, { recursive: true, mode: 0o700 });
    await writeFile(
      file,
      launchdPlist({ executable: options.executable, pathVariable: options.pathVariable, log }),
    );
    await run(["launchctl", "bootout", `gui/${process.getuid?.() ?? 0}`, file]);

    const started = await run(["launchctl", "bootstrap", `gui/${process.getuid?.() ?? 0}`, file]);

    return started.exitCode === 0
      ? { kind: "installed", file, warnings: [] }
      : { kind: "failed", file, detail: started.stderr.trim() };
  }

  if (platform === "linux") {
    const file = path.join(home, ".config", "systemd", "user", "shadowclone-sessions.service");

    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      systemdUnit({ executable: options.executable, pathVariable: options.pathVariable }),
    );
    await run(["systemctl", "--user", "daemon-reload"]);

    const started = await run([
      "systemctl",
      "--user",
      "enable",
      "--now",
      "shadowclone-sessions.service",
    ]);

    if (started.exitCode !== 0) {
      return { kind: "failed", file, detail: started.stderr.trim() };
    }

    await run(["systemctl", "--user", "restart", "shadowclone-sessions.service"]);

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
