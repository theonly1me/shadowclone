import { z } from "zod";
import type { BuildContext } from "../builds/types";
import { createBuildNames } from "./buildNames";
import type { GenerationEngine } from "./generationEngine";
import { browserJson } from "./security";
import { createSkillDrafts } from "./skillDrafts";

const generateRequestSchema = z.strictObject({ previewId: z.uuid() });

export function createModelActions(
  context: BuildContext & { readonly engine?: GenerationEngine },
) {
  const names = createBuildNames(context);
  const drafts = createSkillDrafts(context);

  return async (options: {
    readonly pathname: string;
    readonly body: unknown;
    readonly signal: AbortSignal;
  }): Promise<Response | null> => {
    if (options.pathname === "/api/build-name") {
      return browserJson({ body: await names({ input: options.body, signal: options.signal }) });
    }

    if (options.pathname === "/api/skill/preview") {
      return browserJson({ body: await drafts.preview(options.body) });
    }

    if (options.pathname === "/api/skill/generate") {
      const { previewId } = generateRequestSchema.parse(options.body);
      const skill = await drafts.generate({
        id: previewId,
        signal: options.signal,
      });

      return browserJson({ body: { skill } });
    }

    return null;
  };
}
