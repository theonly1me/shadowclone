import { reviewMarkdown, type ReviewResult } from "@shadowclone/review";

export function reviewFileContent(options: {
  readonly result: ReviewResult;
  readonly file: string;
}): string {
  return options.file.toLowerCase().endsWith(".json")
    ? `${JSON.stringify(options.result, null, 2)}\n`
    : reviewMarkdown(options.result);
}
