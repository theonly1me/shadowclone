import {
  pendingLearningState,
  coveredLearningState,
} from "./learningDisposition";
import { reconcileDirectLearning } from "./reconcileDirect";
import { resolveLearningTarget, existingLearningSkill } from "./learningTarget";
import { validateRouting } from "./routingValidation";
import type { LearningExecution } from "../engine";
import type { FileUpdate } from "../changes";
import type { ProjectPaths } from "../paths";
import type { DiscoveredSkill } from "../skillMaintenance/types";
import { draftSkill, applySkillDraft } from "./draft";
import { routeLearning } from "./planner";
import { skillPublication } from "./publication";
import type { LearningScope } from "./scope";
import type { EnvironmentState, LearningRecord } from "./types";

export async function reconcileLearningBatch(options: {
  readonly paths: ProjectPaths;
  readonly state: EnvironmentState;
  readonly records: readonly LearningRecord[];
  readonly scope: LearningScope;
  readonly skills: readonly DiscoveredSkill[];
  readonly execution: LearningExecution;
}): Promise<{
  readonly state: EnvironmentState;
  readonly updates: readonly FileUpdate[];
  readonly applied: number;
}> {
  const routes = await routeLearning({
    ...options,
    cwd: options.paths.shadowcloneDirectory,
  });
  let state = options.state;
  const updates: FileUpdate[] = [];
  let applied = 0;

  const groups = Map.groupBy(routes, (route) => {
    if (["pending", "excluded", "fact"].includes(route.destination)) {
      return route.destination;
    }

    const skill = options.skills.find(({ id }) => id === route.skillId);

    return skill?.root.owner === "third-party"
      ? `shadowclone-local-${skill.id.slice(0, 20)}`
      : (skill?.name ?? route.name);
  });

  for (const group of groups.values()) {
    const [route] = group;

    if (!route) {
      continue;
    }

    const keys = new Set(group.map(({ key }) => key));
    const records = options.records.filter(({ rule }) => keys.has(rule.key));

    if (
      route.destination === "fact" &&
      records.some((record) => record.rule.body.length > 512)
    ) {
      route.destination = "pending";
    }

    if (["pending", "excluded", "fact"].includes(route.destination)) {
      state = reconcileDirectLearning({
        ...options,
        state,
        route,
        records,
        keys,
      });

      continue;
    }

    if (options.execution.callsRemaining() === 0) {
      break;
    }

    const targetDetails = await resolveLearningTarget({ ...options, route });
    const { selected, companion, name, target, rawOriginal, original } =
      targetDetails;

    const draft = await draftSkill({
      original,
      name,
      description: route.description,
      records,
      execution: options.execution,
      cwd: options.paths.shadowcloneDirectory,
    });

    if (draft.status === "pending") {
      state = pendingLearningState({
        state,
        records,
        keys,
        scope: options.scope,
        reason: draft.reason,
        destinations: [],
      });

      continue;
    }

    if (
      selected &&
      selected.valid !== false &&
      !companion &&
      draft.edits.length === 0 &&
      !draft.body &&
      (!draft.description || draft.description === selected.description)
    ) {
      state = coveredLearningState({
        state,
        records,
        keys,
        scope: options.scope,
        target,
        fingerprint: selected.fingerprint,
      });

      continue;
    }

    if (
      selected &&
      !companion &&
      selected.raw !== selected.redacted &&
      draft.edits.some(
        (edit) => edit.before && !selected.raw.includes(edit.before),
      )
    ) {
      throw new Error(
        "A skill edit overlaps redacted content and needs review",
      );
    }

    const supportedDraft =
      companion && rawOriginal === null
        ? {
            ...draft,
            description: `Use only with the already selected ${selected.name} skill. ${route.description}`,
            body: `# Local guidance for ${selected.name}\n\nUse these instructions only when the installed ${selected.name} skill is already selected. Preserve its workflow and permissions. If it is unavailable, report that limitation.\n\n${draft.body}`,
          }
        : draft;

    const existing = existingLearningSkill({
      ...targetDetails,
      scope: options.scope,
      route,
    });

    try {
      const text = applySkillDraft({
        draft: supportedDraft,
        original: rawOriginal,
        name,
        description: route.description,
        records,
      });

      const publication = await skillPublication({
        ...options,
        state,
        skill: existing,
        name,
        text,
        records,
        routingDescription: route.description,
      });

      validateRouting({ paths: options.paths, state: publication.state });
      state = publication.state;
      updates.push(...publication.updates);
      applied += 1;
    } catch {
      state = pendingLearningState({
        state,
        records,
        keys,
        scope: options.scope,
        reason:
          "Skill validation, routing capacity, or a destination conflict requires review. Resolve it and retry this learning.",
        destinations: [target],
      });
    }
  }

  return { state, updates, applied };
}
