import type { BuildContext } from "../builds/types";
import { descriptionPrompt } from "./descriptionPrompt";
import { descriptionSchema } from "./descriptionProtocol";
import type { GenerationEngine } from "./generationEngine";
import { createReviewedGeneration } from "./reviewedGeneration";

export function createBuildDescriptions(
  context: BuildContext & { readonly engine?: GenerationEngine },
) {
  return createReviewedGeneration({
    context,
    prompt: (input) => descriptionPrompt({ ...context, input }),
    schema: descriptionSchema,
  });
}
