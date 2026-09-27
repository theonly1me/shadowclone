import path from "node:path";
import type { EngineAction } from "../../engine";
import { canonicalPath } from "../../paths";
import type { MeasuredAction } from "./measurementSchema";
import type { GuidanceScenario } from "./schema";

function effect(action: EngineAction): MeasuredAction["effect"] {
  if (["Read", "Glob", "Grep"].includes(action.tool)) {
    return "read-only";
  }

  if (["Edit", "Write", "NotebookEdit"].includes(action.tool)) {
    return action.succeeded === true
      ? "mutation"
      : action.succeeded === false
        ? "read-only"
        : "unknown";
  }

  if (
    action.tool === "Bash" &&
    /^(?:node|bun) --version$/.test(action.command?.trim() ?? "")
  ) {
    return "read-only";
  }

  return "unknown";
}

function beforeEdit(options: {
  read: MeasuredAction;
  actions: readonly MeasuredAction[];
}): boolean | null {
  const completed = options.read.resultSequence;

  if (completed === null) {
    return null;
  }

  const mutations = options.actions.filter(
    (action) => action.effect === "mutation",
  );

  if (
    mutations.some(
      (action) =>
        action.requestSequence !== null && action.requestSequence <= completed,
    )
  ) {
    return false;
  }

  if (
    mutations.some((action) => action.requestSequence === null) ||
    options.actions.some(
      (action) =>
        action.effect === "unknown" &&
        (action.requestSequence === null ||
          action.requestSequence <= completed),
    )
  ) {
    return null;
  }

  return true;
}

export function summarizeDelivery(options: {
  actions: readonly MeasuredAction[];
  scenario: Pick<GuidanceScenario, "expectedSkills" | "expectedReferences">;
}) {
  const reads = options.actions.flatMap((action) =>
    action.tool === "Read" && action.succeeded === true && action.path !== null
      ? [
          {
            path: action.path,
            beforeEdit: beforeEdit({ read: action, actions: options.actions }),
          },
        ]
      : [],
  );

  return {
    reads,
    requiredSkills: options.scenario.expectedSkills.map((name) => {
      const matching = reads.filter((read) =>
        read.path.endsWith(`/${name}/SKILL.md`),
      );

      const timing = matching.some((read) => read.beforeEdit === true)
        ? true
        : matching.length > 0 &&
            matching.every((read) => read.beforeEdit === false)
          ? false
          : null;

      return { name, loaded: matching.length > 0, beforeEdit: timing };
    }),
    expectedReferences: options.scenario.expectedReferences.map(
      (reference) => ({
        path: reference,
        loaded: reads.some((read) => read.path.endsWith(`/${reference}`)),
      }),
    ),
  };
}

export function deliveryTrace(options: {
  readonly directory: string;
  readonly actions: readonly EngineAction[];
  readonly scenario: Pick<
    GuidanceScenario,
    "expectedSkills" | "expectedReferences"
  >;
}) {
  const directory = canonicalPath(options.directory);

  const actions = options.actions.map((action): MeasuredAction => {
    const relative = action.path
      ? path.relative(
          directory,
          canonicalPath(path.resolve(directory, action.path)),
        )
      : null;

    return {
      tool: action.tool,
      path:
        relative !== null &&
        relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative)
          ? relative
          : null,
      succeeded: action.succeeded ?? null,
      requestSequence: action.requestSequence ?? null,
      resultSequence: action.resultSequence ?? null,
      effect: effect(action),
    };
  });

  return {
    measurementVersion: 2 as const,
    actions,
    ...summarizeDelivery({ actions, scenario: options.scenario }),
  };
}
