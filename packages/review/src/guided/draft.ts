import { draftRequestSchema, type DraftResult, type GuidedReport } from "./schema";
import { validatePreparedReview } from "./anchors";
import { readCurrentPull, readPendingReviews, readReviewer, type GuidedGitHub } from "./github";
import { prepareGuidedComments, type GuidedEngine } from "./engine";
import { draftOperation, readDraftReceipt, receiptPath, writeDraftReceipt } from "./receipt";
import { findRecoverableReview, verifyPendingReview } from "./verifyPending";
import { stagedResult, writePendingDraft } from "./writePending";
import { withGuidedSnapshot } from "./snapshot";

export type StageGuidedOptions = {
  readonly report: GuidedReport;
  readonly input: unknown;
  readonly checkout: string;
  readonly github: GuidedGitHub;
  readonly login: string;
  readonly engine: GuidedEngine;
  readonly receiptDirectory: string;
  readonly guidance: string;
  readonly signal?: AbortSignal;
  readonly model?: string;
  readonly authorize?: () => Promise<void>;
};

export async function stageGuidedNotes(options: StageGuidedOptions): Promise<DraftResult> {
  const request = draftRequestSchema.parse(options.input);
  if (request.reportId !== options.report.reportId)
    throw new Error("The notes belong to another report revision.");
  const pull = options.report.pulls.find((item) => item.id === request.pr);
  if (!pull || request.notes.some((note) => note.pr !== pull.id))
    throw new Error("Selected notes must target the selected PR.");
  if (new Set(request.notes.map((note) => note.id)).size !== request.notes.length)
    throw new Error("The selected note ids must be unique.");
  for (const note of request.notes) {
    if (note.evidence.some((id) => !options.report.evidence.some((item) => item.id === id)))
      throw new Error("A selected note refers to evidence outside this report.");
    if (
      note.source &&
      !pull.files.some(
        (file) => file.path === note.source?.path || file.oldPath === note.source?.path,
      ) &&
      !options.report.evidence.some(
        (item) => item.pr === pull.id && item.path === note.source?.path,
      )
    )
      throw new Error("A selected source note targets a file outside this PR.");
  }
  await options.authorize?.();
  if ((await readReviewer(options.github)) !== options.login)
    throw new Error("The GitHub account changed. Reopen the report under the intended reviewer.");
  const current = await readCurrentPull({
    ...options,
    repository: pull.repository,
    number: pull.number,
  });
  if (current.state !== "open") throw new Error("The PR is closed. Your notes remain local.");
  const prefix = "repos/" + pull.repository + "/pulls/" + pull.number;
  const operation = draftOperation(request);
  const file = receiptPath({ directory: options.receiptDirectory, operation });
  const previous = await readDraftReceipt(file);
  const reviews = await readPendingReviews({ ...options, prefix });
  const pending = reviews.filter(
    (review) => review.state === "PENDING" && review.user.login === options.login,
  );
  if (previous) {
    if (
      previous.login !== options.login ||
      previous.repository !== pull.repository ||
      previous.number !== pull.number
    )
      throw new Error("The saved draft receipt belongs to another reviewer or PR.");
    if (previous.headSha !== current.head.sha || previous.baseSha !== current.base.sha)
      throw new Error(
        "The PR changed after a draft attempt. Inspect the existing pending review before staging refreshed notes.",
      );
    const recovered =
      previous.reviewId === null
        ? await findRecoverableReview({
            ...options,
            prefix,
            reviews,
            headSha: previous.headSha,
            prepared: previous.prepared,
          })
        : (reviews.find((review) => review.id === previous.reviewId) ?? null);
    if (recovered) {
      const verified = await verifyPendingReview({
        ...options,
        prefix,
        reviewId: recovered.id,
        headSha: previous.headSha,
        prepared: previous.prepared,
        pullUrl: current.html_url,
      });
      await writeDraftReceipt({
        file,
        receipt: { ...previous, state: "verified", reviewId: verified.id, url: verified.html_url },
      });
      return stagedResult({ prepared: previous.prepared, url: verified.html_url });
    }
    if (previous.state !== "prepared")
      throw new Error(
        "A previous draft write has an uncertain or changed outcome. Inspect GitHub before another write.",
      );
  }
  if (pending.length)
    throw new Error(
      "A pending review already exists. Its manual comments are preserved. Inspect " +
        pending[0]?.html_url +
        " before adding another draft.",
    );
  return withGuidedSnapshot({
    checkout: options.checkout,
    repository: pull.repository,
    headSha: current.head.sha,
    baseSha: current.base.sha,
    use: async (snapshot) => {
      const prepared =
        previous?.prepared ??
        (await prepareGuidedComments({
          ...options,
          ...snapshot,
          notes: request.notes,
          headSha: current.head.sha,
          baseSha: current.base.sha,
        }));
      validatePreparedReview({ prepared, notes: request.notes, files: snapshot.files });
      if (!prepared.comments.length) return stagedResult({ prepared, url: null });
      const refreshed = await readCurrentPull({
        ...options,
        repository: pull.repository,
        number: pull.number,
      });
      if (
        refreshed.state !== "open" ||
        refreshed.head.sha !== current.head.sha ||
        refreshed.base.sha !== current.base.sha
      )
        throw new Error(
          "The PR changed while the agent prepared comments. Your notes remain saved. Refresh and retry.",
        );
      await options.authorize?.();
      if ((await readReviewer(options.github)) !== options.login)
        throw new Error("The GitHub account changed while preparing the draft.");
      const latestReviews = await readPendingReviews({ ...options, prefix });
      if (
        latestReviews.some(
          (review) => review.state === "PENDING" && review.user.login === options.login,
        )
      )
        throw new Error("A pending review appeared while preparing comments. It was preserved.");
      return writePendingDraft({ ...options, pull, current, prepared, operation, file, prefix });
    },
  });
}
