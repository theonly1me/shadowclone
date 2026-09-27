import path from "node:path";
import { fingerprint, readLocalText } from "../localFiles";
import type { FileUpdate } from "../changes";
import type { ProjectPaths } from "../paths";
import type { EnvironmentState } from "./types";
import { learningScopes } from "./scope";
import { skillPublication } from "./publication";
import { materializeSnapshot } from "../redact";

export async function synchronizePublishedSkills(options: { readonly paths: ProjectPaths; readonly state: EnvironmentState }): Promise<{ readonly state: EnvironmentState; readonly updates: readonly FileUpdate[] }> {
  let state = options.state;
  const updates: FileUpdate[] = [];
  const groups = Map.groupBy(state.artifacts.filter((artifact) => artifact.kind === "skill"), (artifact) => `${artifact.scope}/${artifact.name}`);
  for (const artifacts of groups.values()) {
    const current = await Promise.all(artifacts.map(async (artifact) => ({ artifact, text: await readLocalText(artifact.filePath) })));
    const changed = current.filter((entry) => entry.text !== null && fingerprint(entry.text) !== entry.artifact.fingerprint);
    if (new Set(changed.map(({ text }) => text)).size > 1) throw new Error("Maintained skill copies have divergent edits; all versions were preserved");
    if (changed.length === 0 && current.every(({ text }) => text !== null)) continue;
    const authority = changed[0] ?? current.find(({ text }) => text !== null);
    if (!authority?.text) throw new Error("Every copy of a maintained skill is missing; restore a revision first");
    const { artifact, text } = authority;
    const scope = learningScopes(options).find((entry) => entry.key === artifact.scope);
    if (!scope) throw new Error("Maintained skill scope is unavailable");
    const directory = path.dirname(path.dirname(artifact.filePath));
    const snapshot = await materializeSnapshot({ filePath: artifact.filePath, roots: [directory], maximumBytes: 48_000, parse: () => null });
    if (!snapshot) throw new Error("Maintained skill is unavailable");
    const publication = await skillPublication({ paths: options.paths, state, scope, name: artifact.name, text, records: [], routingDescription: artifact.description,
      skill: { id: fingerprint(artifact.filePath), name: artifact.name, description: artifact.description, raw: text, redacted: snapshot.redacted, body: snapshot.redacted, fingerprint: fingerprint(text), relativePath: path.relative(directory, artifact.filePath),
        root: { id: fingerprint(directory), directory, cwd: scope.directory, scope: scope.repository ? "repository" : "global", owner: "user", destination: directory, enabled: true } } });
    state = publication.state;
    updates.push(...publication.updates);
  }
  return { state, updates };
}
