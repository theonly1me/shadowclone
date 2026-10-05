import { learningExecutionLimitsForCalls } from "../../../src/engine";
import type { LearnerConfiguration } from "../workflow/schema";

export function preparationLearningLimits(learner: LearnerConfiguration) {
  return {
    ...learningExecutionLimitsForCalls(learner.maximumCalls),
    timeoutMilliseconds: learner.deadlineSeconds * 1000,
  };
}
