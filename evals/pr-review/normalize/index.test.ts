import { expect, test } from "bun:test";
import { shadowcloneFindings } from "./index";

test("findings in the review body and inline comments are both counted", () => {
  const raw = {
    reviews: [{ id: 7, body: "Summary.\n\n`src/a.ts:12`\n\n**high correctness: Wrong total**\n\nThe total is wrong.\n\n<!-- shadowclone-review -->", submitted_at: "2026-10-09T10:00:00Z", user: { login: "clone[bot]" } }],
    reviewComments: [{ pull_request_review_id: 7, path: "src/b.ts", line: 3, body: "**medium security: Unsafe call**", user: { login: "clone[bot]" } }],
    issueComments: [],
  };

  expect(shadowcloneFindings({ caseId: "c01", raw, startedAt: "2026-10-09T09:00:00Z" }).map((finding) => [finding.path, finding.line])).toEqual([
    ["src/b.ts", 3],
    ["src/a.ts", 12],
  ]);
});
