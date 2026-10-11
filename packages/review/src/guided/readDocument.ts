import { createHash } from "node:crypto";
import { guidedReportSchema, type GuidedReport } from "./schema";

export async function readGuidedDocument(
  file: string,
): Promise<{ readonly html: string; readonly report: GuidedReport; readonly data: unknown }> {
  const source = Bun.file(file);
  if (source.size > 40_000_000)
    throw new Error(
      "The review document exceeds 40 MB. Split unrelated reviews before connecting it.",
    );
  const html = await source.text();
  const embedded = /<script type="application\/json" id="guided-review">([\s\S]*?)<\/script>/.exec(
    html,
  );
  if (!embedded?.[1]) throw new Error("This file is not a collected guided-review document.");
  const data: unknown = JSON.parse(embedded[1]);
  const report = guidedReportSchema.parse(data);
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify(
        report.pulls.map((pull) => [pull.repository, pull.number, pull.baseSha, pull.headSha]),
      ),
    )
    .digest("hex");
  if (report.reportId !== fingerprint)
    throw new Error("The report identity does not match its pinned PR revisions.");
  return { html, report, data };
}
