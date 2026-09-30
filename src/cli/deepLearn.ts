import { runLearningService } from "../learning/service";
import { promptConfirmation } from "./confirm";

export type { DeepLearningResult } from "../learning/service";

export async function runDeepLearning(
  options: Parameters<typeof runLearningService>[0],
): ReturnType<typeof runLearningService> {
  return runLearningService({
    ...options,
    confirm: options.confirm ?? promptConfirmation,
  });
}
