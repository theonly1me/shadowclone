import { z } from "zod";
import { checkSchema } from "./schema";

export const judgmentSchema = z.strictObject({ checks: z.array(checkSchema) });
export const judgmentOutputSchema = z.toJSONSchema(judgmentSchema, { target: "draft-7" });
export const legacyJudgmentOutputSchema = z.toJSONSchema(judgmentSchema, { target: "draft-2020-12" });
