import path from "node:path";
import { cloneEngine, type CloneConfig } from "../config/config";
import type { PullFacts } from "./resolve";
import { prepareCodexHome } from "./codexHome";
import type { Processes } from "./processes";
import type { Workspace } from "./workspace";

export type ReviewStage = {
  readonly name: "prepare" | "checks" | "analyze" | "publish";
  readonly arguments: readonly string[];
};

export function reviewStages(options: {
  readonly config: CloneConfig;
  readonly pull: PullFacts;
  readonly workspace: Workspace;
}): readonly ReviewStage[] {
  const { config, pull, workspace } = options;
  const trusted = !pull.fork && pull.ownerAuthored;
  const network = trusted ? "on" : "off";
  const file = (name: string) => path.join(workspace.root, name);
  const checkout = file("pull-request");
  const engineOptions = [
    "--engine",
    cloneEngine(config),
    ...(config.model === undefined ? [] : ["--model", config.model]),
    ...(config.provider === "openai-compatible" && config.baseUrl !== undefined
      ? ["--base-url", config.baseUrl]
      : []),
  ];
  const prepare: ReviewStage = {
    name: "prepare",
    arguments: [
      "shadowclone",
      "review",
      "prepare",
      "--repo",
      config.repository,
      "--pr",
      String(pull.number),
      "--head",
      pull.head,
      "--network",
      network,
      "--checkout",
      checkout,
      "--output",
      file("packet.json"),
    ],
  };
  const checks: ReviewStage = {
    name: "checks",
    arguments: [
      "shadowclone",
      "review",
      "checks",
      "--packet",
      file("packet.json"),
      "--checkout",
      checkout,
      "--output",
      file("checks.json"),
    ],
  };
  const analyze: ReviewStage = {
    name: "analyze",
    arguments: [
      "shadowclone",
      "review",
      "analyze",
      "--packet",
      file("packet.json"),
      ...(trusted ? ["--checks", file("checks.json")] : []),
      "--checkout",
      checkout,
      ...engineOptions,
      "--network",
      network,
      "--output",
      file("result.json"),
    ],
  };
  const publish: ReviewStage = {
    name: "publish",
    arguments: ["shadowclone", "review", "publish", "--input", file("result.json")],
  };

  return trusted ? [prepare, checks, analyze, publish] : [prepare, analyze, publish];
}

export async function runReview(options: {
  readonly config: CloneConfig;
  readonly pull: PullFacts;
  readonly workspace: Workspace;
  readonly processes: Processes;
  readonly environment: Readonly<Record<string, string | undefined>>;
  readonly signal: AbortSignal;
}): Promise<{ readonly exitCode: number; readonly tail: string }> {
  const engineEnvironment: Readonly<Record<string, string>> =
    cloneEngine(options.config) === "codex"
      ? { CODEX_HOME: await prepareCodexHome(options) }
      : {};
  let last = { exitCode: 0, tail: "" };

  for (const stage of reviewStages(options)) {
    last = await options.processes.stream({
      arguments: stage.arguments,
      cwd: options.workspace.root,
      environment: stage.name === "analyze" ? engineEnvironment : {},
      signal: options.signal,
    });

    if (last.exitCode !== 0) {
      return {
        exitCode: last.exitCode,
        tail: `The review stage ${stage.name} failed.\n${last.tail}`,
      };
    }
  }

  return last;
}
