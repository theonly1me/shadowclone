import path from "node:path";
import type { LearningExecution } from "../engine";
import { fingerprint, readLocalText } from "../localFiles";
import type { FileUpdate } from "../changes";
import { materializeSnapshot } from "../redact";
import type { ProjectPaths } from "../paths";
import type { DiscoveredSkill } from "../skillMaintenance/types";
import { draftSkill, applySkillDraft } from "./draft";
import { routeLearning } from "./planner";
import { skillPublication } from "./publication";
import { recordFingerprint } from "./records";
import type { LearningScope } from "./scope";
import type { EnvironmentState, LearningRecord } from "./types";
import { renderSkillRouting } from "./context";
import { learningScopes } from "./scope";

function validateRouting(options: { readonly paths: ProjectPaths; readonly state: EnvironmentState }): void {
  const scopes = learningScopes(options);
  for (const scope of scopes) renderSkillRouting({ state: options.state, scopes: scopes.filter((entry) => entry.key === "global" || entry.key === scope.key) });
}

export async function reconcileLearningBatch(options: {
  readonly paths: ProjectPaths; readonly state: EnvironmentState; readonly records: readonly LearningRecord[];
  readonly scope: LearningScope; readonly skills: readonly DiscoveredSkill[]; readonly execution: LearningExecution;
}): Promise<{ readonly state: EnvironmentState; readonly updates: readonly FileUpdate[]; readonly applied: number }> {
  const routes = await routeLearning({ ...options, cwd: options.paths.shadowcloneDirectory });
  let state = options.state;
  const updates: FileUpdate[] = [];
  let applied = 0;
  const groups = Map.groupBy(routes, (route) => {
    if (["pending", "excluded", "fact"].includes(route.destination)) return route.destination;
    const skill = options.skills.find(({ id }) => id === route.skillId);
    return skill?.root.owner === "third-party" ? `shadowclone-local-${skill.id.slice(0, 20)}` : skill?.name ?? route.name;
  });
  for (const group of groups.values()) {
    const [route] = group;
    if (!route) continue;
    const keys = new Set(group.map(({ key }) => key));
    const records = options.records.filter(({ rule }) => keys.has(rule.key));
    if (route.destination === "fact" && records.some((record) => record.rule.body.length > 512)) route.destination = "pending";
    if (["pending", "excluded", "fact"].includes(route.destination)) {
      const facts = records.map((record) => ({ scope: options.scope.key, text: record.rule.body, learningKeys: [record.rule.key] }));
      const previousFacts = state.facts;
      state = { ...state,
        facts: route.destination === "fact" ? [...state.facts.filter((fact) => !fact.learningKeys.some((key) => keys.has(key))), ...facts] : state.facts,
        dispositions: [...state.dispositions.filter((entry) => !keys.has(entry.key) || entry.scope !== options.scope.key), ...records.map((record) => ({
          key: record.rule.key, scope: options.scope.key, inputFingerprint: recordFingerprint(record), status: route.destination === "excluded" ? "excluded" as const : route.destination === "fact" ? "published" as const : "pending" as const,
          reason: route.reason, destinations: route.destination === "fact" ? ["native-context"] : [],
        }))],
      };
      if (route.destination === "fact") {
        try { validateRouting({ paths: options.paths, state }); }
        catch { state = { ...state, facts: previousFacts, dispositions: state.dispositions.map((entry) => keys.has(entry.key) && entry.scope === options.scope.key ? { ...entry, status: "pending", reason: "Native context exceeds its 4 KiB budget; move this knowledge into a workflow skill", destinations: [] } : entry) }; }
      }
      continue;
    }
    if (options.execution.callsRemaining() === 0) break;
    const selected = options.skills.find(({ id }) => id === route.skillId) ?? null;
    const companion = selected?.root.owner === "third-party";
    const name = route.destination === "baseline" ? "shadowclone-baseline" : companion ? `shadowclone-local-${selected.id.slice(0, 20)}` : selected?.name ?? route.name;
    const target = selected && !companion ? path.join(selected.root.directory, selected.relativePath) : path.join(options.scope.directory, ".agents/skills", name, "SKILL.md");
    const rawOriginal = selected && !companion ? selected.raw : await readLocalText(target);
    const snapshot = selected && !companion ? null : await materializeSnapshot({ filePath: target, roots: [path.join(options.scope.directory, ".agents/skills")], maximumBytes: 48_000, parse: () => null });
    const original = selected && !companion ? selected.redacted : snapshot?.redacted ?? null;
    const draft = await draftSkill({ original, name, description: route.description, records, execution: options.execution, cwd: options.paths.shadowcloneDirectory });
    if (draft.status === "pending") {
      state = { ...state, dispositions: [...state.dispositions.filter((entry) => !keys.has(entry.key) || entry.scope !== options.scope.key), ...records.map((record) => ({ key: record.rule.key, scope: options.scope.key, inputFingerprint: recordFingerprint(record), status: "pending" as const, reason: draft.reason, destinations: [] }))] };
      continue;
    }
    if (selected && selected.valid !== false && !companion && draft.edits.length === 0 && !draft.body && (!draft.description || draft.description === selected.description)) {
      state = { ...state, dispositions: [...state.dispositions.filter((entry) => !keys.has(entry.key) || entry.scope !== options.scope.key), ...records.map((record) => ({ key: record.rule.key, scope: options.scope.key, inputFingerprint: recordFingerprint(record), status: "covered" as const, reason: "The complete learning is already present in the existing skill", destinations: [target], fingerprints: { [target]: selected.fingerprint } }))] };
      continue;
    }
    if (selected && !companion && selected.raw !== selected.redacted && draft.edits.some((edit) => edit.before && !selected.raw.includes(edit.before))) throw new Error("A skill edit overlaps redacted content and needs review");
    const supportedDraft = companion && rawOriginal === null ? { ...draft, description: `Use only with the already selected ${selected.name} skill. ${route.description}`, body: `# Local guidance for ${selected.name}\n\nUse these instructions only when the installed ${selected.name} skill is already selected. Preserve its workflow and permissions. If it is unavailable, report that limitation.\n\n${draft.body}` } : draft;
    const existing = selected && !companion ? selected : rawOriginal === null ? null : {
      id: fingerprint(target), root: { id: fingerprint(path.dirname(path.dirname(target))), directory: path.dirname(path.dirname(target)), cwd: options.scope.directory, scope: options.scope.repository === null ? "global" as const : "repository" as const, owner: "user" as const, destination: path.dirname(path.dirname(target)), enabled: true },
      relativePath: `${name}/SKILL.md`, raw: rawOriginal, redacted: original ?? "", fingerprint: fingerprint(rawOriginal), name, description: route.description, body: original ?? "",
    };
    try {
      const text = applySkillDraft({ draft: supportedDraft, original: rawOriginal, name, description: route.description, records });
      const publication = await skillPublication({ ...options, state, skill: existing, name, text, records, routingDescription: route.description });
      validateRouting({ paths: options.paths, state: publication.state });
      state = publication.state;
      updates.push(...publication.updates);
      applied += 1;
    } catch {
      state = { ...state, dispositions: [...state.dispositions.filter((entry) => !keys.has(entry.key) || entry.scope !== options.scope.key), ...records.map((record) => ({ key: record.rule.key, scope: options.scope.key, inputFingerprint: recordFingerprint(record), status: "pending" as const, reason: "Skill validation, routing capacity, or a destination conflict requires review. Resolve it and retry this learning.", destinations: [target] }))] };
    }
  }
  return { state, updates, applied };
}
