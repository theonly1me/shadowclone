import { pendingInlineComment } from "./anchors";
import { pendingReviewSchema, readCurrentPull } from "./github";
import { writeDraftReceipt, type DraftReceipt } from "./receipt";
import { verifyPendingReview } from "./verifyPending";
import type { DraftResult, PreparedReview, GuidedReport } from "./schema";
import type { StageGuidedOptions } from "./draft";

export function stagedResult(options: {
  readonly prepared: PreparedReview;
  readonly url: string | null;
}): DraftResult {
  return {
    url: options.url,
    stagedIds: options.prepared.comments.flatMap((comment) => comment.noteIds),
    held: options.prepared.held,
  };
}

export async function writePendingDraft(
  options: StageGuidedOptions & {
    readonly pull: GuidedReport["pulls"][number];
    readonly current: Awaited<ReturnType<typeof readCurrentPull>>;
    readonly prepared: PreparedReview;
    readonly operation: string;
    readonly file: string;
    readonly prefix: string;
  },
): Promise<DraftResult> {
  const { pull, current, prepared, operation, file, prefix } = options;
  const receipt: DraftReceipt = {
    operation,
    login: options.login,
    repository: pull.repository,
    number: pull.number,
    headSha: current.head.sha,
    baseSha: current.base.sha,
    prepared,
    state: "prepared",
    reviewId: null,
    url: null,
  };
  await writeDraftReceipt({ file, receipt });
  await writeDraftReceipt({ file, receipt: { ...receipt, state: "creating" } });
  const created = pendingReviewSchema.parse(
    await options.github.request({
      endpoint: prefix + "/reviews",
      method: "POST",
      input: {
        commit_id: current.head.sha,
        comments: prepared.comments.map(pendingInlineComment),
      },
    }),
  );
  await writeDraftReceipt({
    file,
    receipt: { ...receipt, state: "written", reviewId: created.id, url: created.html_url },
  });
  const verified = await verifyPendingReview({
    ...options,
    prefix,
    reviewId: created.id,
    headSha: current.head.sha,
    prepared,
    pullUrl: current.html_url,
  });
  const after = await readCurrentPull({
    ...options,
    repository: pull.repository,
    number: pull.number,
  });
  if (after.head.sha !== current.head.sha || after.base.sha !== current.base.sha)
    throw new Error(
      "The pending draft belongs to an older PR revision. Inspect " +
        verified.html_url +
        " before editing or submitting it.",
    );
  await writeDraftReceipt({
    file,
    receipt: { ...receipt, state: "verified", reviewId: verified.id, url: verified.html_url },
  });
  return stagedResult({ prepared, url: verified.html_url });
}
