import path from "node:path";
import { runClaudeCode } from "../engine/claudeCode";
import { runHostCommand } from "../io/hostCommand";
import { projectPaths } from "../paths";
import { reviewLocally, reviewMarkdown } from "../review";
import { ownedWrite } from "../storage";
import { parseReviewArguments } from "./reviewArguments";
import { requestCloudReview } from "./reviewCloud";
import { reviewStages } from "./reviewStages";

async function commandOutput(options: { readonly arguments: readonly string[]; readonly cwd: string; readonly failure: string }): Promise<string> {
  const result = await runHostCommand({ arguments: options.arguments, cwd: options.cwd });

  if (result.exitCode !== 0) {
    throw new Error(`${options.failure}: ${result.stderr.trim().slice(0, 300)}`);
  }

  return result.stdout.trim();
}

export async function reviewCommand(arguments_: readonly string[]): Promise<void> {
  const [first = "", ...rest] = arguments_;
  const stage = reviewStages[first];

  if (stage !== undefined) {
    await stage(rest);
    return;
  }

  const parsed = parseReviewArguments(arguments_);
  const cwd = process.cwd();
  const checkout = await commandOutput({
    arguments: ["git", "rev-parse", "--show-toplevel"],
    cwd,
    failure: "Run shadowclone review inside a Git repository",
  });
  const repository =
    parsed.repository ??
    (await commandOutput({
      arguments: ["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
      cwd: checkout,
      failure: "gh could not find the GitHub repository for this checkout",
    }));

  if (parsed.cloud) {
    await requestCloudReview({ repository, number: parsed.number });
    return;
  }

  const result = await reviewLocally({
    repository,
    number: parsed.number,
    checkout,
    reviewModel: { runner: runClaudeCode, model: parsed.model, effort: parsed.effort, network: parsed.network },
    runChecks: parsed.runChecks,
    onProgress: (message) => console.error(message),
  });
  const output = path.resolve(
    parsed.output ??
      path.join(
        projectPaths.shadowcloneDirectory,
        "reviews",
        repository.replace("/", "-"),
        `pr-${result.pull.number}-${result.pull.headSha.slice(0, 7)}.md`,
      ),
  );

  await ownedWrite({ path: output, content: reviewMarkdown(result) });
  console.log(`${result.findings.length} ${result.findings.length === 1 ? "finding" : "findings"}. Review written to ${output}`);
}
