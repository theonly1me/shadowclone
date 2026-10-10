import { z } from "zod";

const trivySchema = z.object({
  Results: z
    .array(
      z.object({
        Target: z.string(),
        Misconfigurations: z
          .array(
            z.object({
              ID: z.string(),
              Severity: z.string(),
              Title: z.string(),
              Message: z.string().optional(),
              CauseMetadata: z.object({ StartLine: z.number().nullable().optional() }).optional(),
            }),
          )
          .nullable()
          .optional(),
      }),
    )
    .nullable()
    .optional(),
});

export function parseTrivy(
  output: string,
): readonly {
  readonly path: string;
  readonly line: number;
  readonly message: string;
  readonly fileLevel: boolean;
}[] {
  const start = output.indexOf("{");
  const parsed = trivySchema.safeParse(JSON.parse(start < 0 ? "{}" : output.slice(start)));

  if (!parsed.success) {
    return [];
  }

  return (parsed.data.Results ?? []).flatMap((result) =>
    (result.Misconfigurations ?? []).map((misconfiguration) => ({
      path: result.Target,
      line: misconfiguration.CauseMetadata?.StartLine ?? 1,
      fileLevel: misconfiguration.CauseMetadata?.StartLine == null,
      message: `${misconfiguration.Severity} ${misconfiguration.ID}: ${misconfiguration.Title}${misconfiguration.Message ? ` ${misconfiguration.Message}` : ""}`,
    })),
  );
}
