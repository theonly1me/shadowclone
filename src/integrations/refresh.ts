import { fingerprint, readLocalText } from "../localFiles";
import { projectPaths } from "../paths";
import { compileContext } from "./compile";
import { applyIntegrationFiles, prepareIntegrationFiles } from "./files";
import { hasOwnedHooks } from "./hookConfig";
import { managedSection } from "./markdown";
import { readIntegrations, saveIntegration } from "./state";
import { integrationFilePath } from "./targets";
import type { IntegrationOptions } from "./types";

export async function refreshIntegrations(options: IntegrationOptions = {}): Promise<{ readonly refreshed: number; readonly preserved: number }> {
  const paths = options.paths ?? projectPaths;
  let refreshed = 0;
  let preserved = 0;
  for (const integration of await readIntegrations(paths)) {
    const profile = await compileContext({ ...options, paths, cwd: integration.directory, scope: integration.scope === "global" ? "global" : "combined" });
    if (profile === null) continue;
    try {
      const changes = await prepareIntegrationFiles({ integration, profile });
      await applyIntegrationFiles(changes);
      await saveIntegration({ paths, integration: { ...integration, files: changes.map((change) => change.record) } });
      refreshed += 1;
    } catch {
      preserved += 1;
    }
  }
  return { refreshed, preserved };
}

export async function integrationHealth(options: IntegrationOptions = {}): Promise<readonly string[]> {
  const paths = options.paths ?? projectPaths;
  const lines: string[] = [];
  for (const integration of await readIntegrations(paths)) {
    let status = "installed";
    for (const file of integration.files) {
      try {
        const text = await readLocalText(integrationFilePath({ integration, file }));
        if (text === null) { status = "missing files"; break; }
        if (file.kind === "hooks" ? !hasOwnedHooks({ text, integration }) : fingerprint(file.kind === "instructions" ? managedSection(text) ?? "" : text) !== file.fingerprint) {
          status = "edited managed content";
          break;
        }
      } catch {
        status = "invalid destination";
        break;
      }
    }
    if (status === "installed") {
      const profile = await compileContext({ ...options, paths, cwd: integration.directory, scope: integration.scope === "global" ? "global" : "combined" });
      if (profile === null) status = "blocked by policy";
      else {
        const changes = await prepareIntegrationFiles({ integration, profile });
        if (changes.some((change) => change.next !== change.previous)) status = "stale";
      }
    }
    lines.push(`${integration.agent} (${integration.scope}): ${status}; ${integration.deliveredAt === null ? "hook not observed" : "hook delivery observed"}`);
  }
  return lines;
}
