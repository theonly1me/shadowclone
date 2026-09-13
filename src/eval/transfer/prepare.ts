import os from "node:os";
import { command } from "./command";
import { captureContext } from "./context";
import { prepareFreshTasks } from "./freshTasks";
import { preflightRepository } from "./preflight";
import { loadEvaluationProfile } from "./profile";
import type { ResolvedTransferSetup } from "./setup";
import { fingerprint } from "./structured";
import { loadSuite, saveSuite } from "./suite";
import type {
  EvaluationSuite,
  ModelCall,
  PreparedEval,
} from "./types";

async function repositoryState(repository: string): Promise<{
  readonly commit: string;
  readonly dirtyFileCount: number;
}> {
  const [commit, status] = await Promise.all([
    command({ arguments: ["git", "rev-parse", "HEAD"], cwd: repository }),
    command({
      arguments: ["git", "status", "--porcelain", "--untracked-files=all"],
      cwd: repository,
    }),
  ]);
  return {
    commit,
    dirtyFileCount: status ? status.split("\n").length : 0,
  };
}

function validateSuite(options: {
  readonly suite: EvaluationSuite;
  readonly repository: string;
  readonly commit: string;
  readonly profile: string;
}): void {
  if (options.suite.repository !== options.repository) {
    throw new Error("Evaluation suite belongs to a different repository");
  }
  if (options.suite.baseCommit !== options.commit) {
    throw new Error("Evaluation suite requires its original repository HEAD");
  }
  if (options.suite.profileSnapshot.fingerprint !== fingerprint(options.profile)) {
    throw new Error("Evaluation suite requires its original frozen profile");
  }
}

async function freshSuite(options: {
  readonly setup: ResolvedTransferSetup;
  readonly commit: string;
  readonly profile: string;
  readonly ruleCount: number;
  readonly call: ModelCall;
  readonly onStep: (message: string) => void;
}): Promise<EvaluationSuite> {
  options.onStep("Capturing the consented personal agent environment");
  const context = await captureContext({
    enabled: options.setup.config.sources["agent-context"],
    home: os.homedir(),
    repository: options.setup.repository,
    engine: options.setup.engine,
  });
  options.onStep(
    `Preparing ${options.setup.count} fresh additive coding task(s)`,
  );
  const tasks = await prepareFreshTasks({
    repository: options.setup.repository,
    startingCommit: options.commit,
    count: options.setup.count,
    suppliedTask: options.setup.suppliedTask,
    profile: options.profile,
    context,
    call: options.call,
  });
  const suite: EvaluationSuite = {
    schemaVersion: 2,
    suiteId: crypto.randomUUID(),
    repository: options.setup.repository,
    baseCommit: options.commit,
    context,
    profileSnapshot: {
      kind: "current",
      fingerprint: fingerprint(options.profile),
      ruleCount: options.ruleCount,
    },
    tasks,
  };
  await saveSuite({ paths: options.setup.paths, suite });
  return suite;
}

export async function prepareEvaluation(options: {
  readonly setup: ResolvedTransferSetup;
  readonly call: ModelCall;
  readonly json: boolean;
  readonly onStep: (message: string) => void;
}): Promise<PreparedEval> {
  const state = await repositoryState(options.setup.repository);
  const profile = await loadEvaluationProfile({
    profileDirectory: options.setup.paths.profileDirectory,
    repository: options.setup.repositoryIdentity,
  });
  options.onStep("Checking the disposable current-HEAD snapshot");
  const preflight = await preflightRepository({
    repository: options.setup.repository,
    commit: state.commit,
  });
  let suite: EvaluationSuite;
  if (options.setup.suiteId) {
    options.onStep("Loading the frozen coding-task suite");
    suite = await loadSuite({
      paths: options.setup.paths,
      suiteId: options.setup.suiteId,
    });
    validateSuite({
      suite,
      repository: options.setup.repository,
      commit: state.commit,
      profile: profile.markdown,
    });
  } else {
    suite = await freshSuite({
      setup: options.setup,
      commit: state.commit,
      profile: profile.markdown,
      ruleCount: profile.ruleCount,
      call: options.call,
      onStep: options.onStep,
    });
  }
  if (state.dirtyFileCount > 0 && !options.setup.saved && !options.json) {
    console.warn(
      `Warning: ignoring ${state.dirtyFileCount} uncommitted source file(s); evaluation starts from HEAD.`,
    );
  }
  return {
    ...suite,
    schemaVersion: 9,
    evalId: options.setup.evalId,
    engine: options.setup.engine,
    model: options.setup.model,
    reasoningEffort: options.setup.reasoningEffort ?? null,
    dependencyMode: "current",
    repeat: options.setup.repeat,
    timeoutSeconds: options.setup.timeoutSeconds,
    maxBudgetUsd: options.setup.maxBudgetUsd ?? null,
    dirtyFileCount: state.dirtyFileCount,
    preflight: preflight.checks,
  };
}
