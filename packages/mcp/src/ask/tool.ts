import { z } from "zod";
import { liveIdPattern } from "@shadowclone/live";
import { boardQuestionSchema } from "@shadowclone/live/board";

export const askToolName = "shadowclone_ask";

export const askTool = {
  name: askToolName,
  description:
    "Ask the owner a decision that is theirs, when the task text does not answer it. Use only in " +
    "a shadowclone live session, with the live-xxxxxxxx id from your session start note. Give 2 to " +
    "4 options and the option that you recommend. The tool waits for the owner's answer and " +
    "returns it. If no answer arrives in time, end your turn with the question and take no option. " +
    "A session can have one open question.",
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  inputSchema: {
    type: "object",
    properties: {
      session: { type: "string", description: "your live-xxxxxxxx id from the session start note" },
      question: { type: "string", description: "the decision that the owner must make" },
      options: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 4,
        description: "2 to 4 short choices",
      },
      recommended: { type: "string", description: "the option that you recommend, word for word" },
    },
    required: ["session", "question", "options", "recommended"],
    additionalProperties: false,
  },
};

export const askInputSchema = z
  .strictObject({
    session: z.string().regex(liveIdPattern),
    question: boardQuestionSchema.shape.text,
    options: boardQuestionSchema.shape.options,
    recommended: boardQuestionSchema.shape.recommended,
  })
  .refine((input) => input.options.includes(input.recommended), {
    message: "recommended must be one of the options",
    path: ["recommended"],
  });
