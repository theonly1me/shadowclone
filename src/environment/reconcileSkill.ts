import type { FileUpdate } from "../changes";
import type { LearningExecution } from "../engine";
import type { ProjectPaths } from "../paths";
import type { DiscoveredSkill } from "../skillMaintenance/types";
import { draftSkill, applySkillDraft } from "./draft";
import { pendingDraftReasons } from "./draftReview";
import { generatedSkillBody } from "./generatedBody";
import { pendingLearningState, coveredLearningState } from "./learningDisposition";
import { resolveLearningTarget, existingLearningSkill } from "./learningTarget";
import type { LearningRoute } from "./planner";
import { skillPublication } from "./publication";
import { validateRouting } from "./routingValidation";
import type { LearningScope } from "./scope";
import type { EnvironmentState, LearningRecord } from "./types";

export async function reconcileSkillLearning(options: {
  readonly paths: ProjectPaths;
  readonly state: EnvironmentState;
  readonly records: readonly LearningRecord[];
  readonly keys: ReadonlySet<string>;
  readonly route: LearningRoute;
  readonly scope: LearningScope;
  readonly skills: readonly DiscoveredSkill[];
  readonly execution: LearningExecution;
}): Promise<{ readonly state: EnvironmentState; readonly updates: readonly FileUpdate[]; readonly applied: number }> {
  const { records, route } = options;
  const targetDetails = await resolveLearningTarget(options);
  const { selected, companion, name, target, rawOriginal, original } = targetDetails;
  const pending = (reason: string) => ({
    state: pendingLearningState({
      ...options,
      reasons: records.map(({ rule }) => ({ key: rule.key, reason })),
      destinations: [target],
    }),
    updates: [],
    applied: 0,
  });
  const draft = await draftSkill({
    original,
    name,
    description: route.description,
    records,
    execution: options.execution,
    cwd: options.paths.shadowcloneDirectory,
  });

  if (draft.outcomes.some(({ disposition }) => disposition === "pending")) {
    return {
      state: pendingLearningState({
        ...options,
        reasons: pendingDraftReasons(draft),
        destinations: [target],
      }),
      updates: [],
      applied: 0,
    };
  }

  if (
    selected && selected.valid !== false && !companion &&
    draft.edits.length === 0 && !draft.body &&
    (!draft.description || draft.description === selected.description)
  ) {
    return {
      state: coveredLearningState({
        ...options,
        target,
        fingerprint: selected.fingerprint,
      }),
      updates: [],
      applied: 0,
    };
  }

  if (
    selected && !companion && selected.raw !== selected.redacted &&
    draft.edits.some((edit) => edit.before && !selected.raw.includes(edit.before))
  ) {
    return pending("The proposed edit overlaps redacted content. Review the target skill locally before retrying.");
  }

  let text: string;

  try {
    const supportedDraft = companion && rawOriginal === null
      ? {
          ...draft,
          description: `Use only with the already selected ${selected.name} skill. ${draft.description || route.description}`,
          body: `# Local guidance for ${selected.name}\n\nUse these instructions only when the installed ${selected.name} skill is already selected. Preserve its workflow and permissions. If it is unavailable, report that limitation.\n\n${generatedSkillBody({ text: draft.body, name })}`,
        }
      : draft;

    text = applySkillDraft({ draft: supportedDraft, original: rawOriginal, name, description: route.description, records });
  } catch {
    return pending("The draft failed skill metadata, section-edit, or size validation. Review the target document and retry this learning.");
  }

  let publication: Awaited<ReturnType<typeof skillPublication>>;

  try {
    publication = await skillPublication({
      ...options,
      skill: existingLearningSkill({ ...targetDetails, scope: options.scope, route }),
      name,
      text,
    });
  } catch {
    return pending("Publication needs review of destination ownership or supporting files. Resolve the target conflict and retry this learning.");
  }

  try {
    validateRouting({ paths: options.paths, state: publication.state });
  } catch {
    return pending("Native skill routing exceeds its 4 KiB budget. Shorten validated skill descriptions or narrow the selected routes before retrying.");
  }

  return { ...publication, applied: 1 };
}
