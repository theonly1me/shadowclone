#!/usr/bin/env bun
import { handleSkillsMigration } from "./migrateSkills";

import packageManifest from "../../package.json";
import { serveMcp } from "../mcp";
import { doctor } from "./doctor";
import { studyEvalCommand } from "./studyEval";
import { forgetAll } from "./forget";
import { runSessionEndHook, runSessionStartHook } from "./hooks";
import { handleSetupCommand } from "./setup";
import { importRepositoryGuidanceCommand } from "./import";
import { handleNativeCommand } from "./native";
import { handlePreferenceCommand } from "./preferences";
import { learn } from "./learn";
import { parseLearnOptions } from "./learnOptions";
import { runClone } from "./run";
import { parseRecallOptions, recallCommand } from "./recall";
import { handleProfileRepairCommand } from "./profileRepair";
import { handleMigrateCommand } from "./migrate";
import { harnessCheckCommand, parseHarnessCheck } from "./harnessCheck";
import { listSeedGuidance } from "./skills";
import { handleSkillMaintenance } from "./skillMaintenance";
import { showHome } from "./home";
import { redactSecrets } from "../redact";
import { taskCommandLine } from "./tasks";
import { handleWorkflowEval } from "./workflowEval";
import { handleFixedEval } from "./fixedEval";
import { handleFourSetupEval } from "./fourSetupEval";

const usage =
  "Usage: shadowclone <init [--advanced]|init --status [--json]|init (--learn|--no-learn) (--skill-maintenance|--no-skill-maintenance) (--background-learning|--no-background-learning)|init --repo [--personal|--no-personal] [--skill <name>] [--no-enforce]|check [--changed] [--format human|json|claude-stop]|import|wizard|skills|learn [--deep] [--dry-run] [--apply] [--engine <id>] [--model <id>] [--reasoning-effort <level>] [--max-calls <n>]|doctor|profile repair [--decisions <file>] [--apply]|migrate skills [--apply] [--automatic] [--memory] [--activate-only] [--repo <path>]|migrate claude-memory [--decisions <file>] [--apply]|install [--agent claude-code|codex|cursor|antigravity|pi|all] [--global|--local] [--subagent] [--auto-delegate]|uninstall [--agent <agent>] [--global|--local]|context [--explain [--json]]|recall <query> [--limit 1..10]|sync|run <task>|eval --protocol preference-study-v1 --phase prepare|coverage|assemble|validate|run|report [--stage <stage>] [--preparation-file <path>] [--key-file <path>] [--tasks-file <path>] [--suite-file <path>] [--output-directory <path>] [--coverage-file <path>] [--concurrency N] --yes|mcp|forget --all>";

function printUsage(): void {
  console.log(usage);
  console.log("Skill tree: wizard [--repo] [--no-open]; terminal setup: wizard --cli");
  console.log(
    "Preferences: remember [--repo|--global] <text>, history [revision-id], undo <revision-id>, learning enable|disable|status|list|pending|show <key>|apply <key>|reject <key>|repositories|bind <id>",
  );
  console.log("Review: learning retire|narrow <key>, learning replace <key> <guidance>, learning remove-source <source> [--apply --expected <fingerprint>]");
  console.log("Behavior: learning probe <key> --agent claude-code|codex --task <synthetic task> --expect <exact response> [--model <model>] --yes; learning probe status; learning acknowledge <key>");
  console.log("Work: task start|status|list|checkpoint|verify|pause|resume|cancel|action|maintain|reconcile; task grants|grant|revoke; task --help");
  console.log("Fixed evals: eval --protocol preference-respect-v2 --help; legacy three-setup evals use preference-respect-v1");
  console.log(
    "Skill maintenance: skills configure [--repo|--global], skills list|update|pending, skills show|apply|reject <id>, skills manage <skill-id>, skills disable",
  );
}

function printVersion(): void {
  console.log(packageManifest.version);
}

async function main(arguments_: readonly string[]): Promise<void> {
  const [command, ...rest] = arguments_;

  if (command === undefined) {
    await showHome();

    return;
  }

  if (command === "--help" || command === "-h" || command === "help") {
    printUsage();

    return;
  }

  if (command === "--version" || command === "-v") {
    printVersion();

    return;
  }

  if (await handleSetupCommand({ command, arguments: rest })) {
    return;
  }

  if (command === "check") {
    const parsed = parseHarnessCheck(rest);

    if (parsed === null) {
      throw new Error(
        "Use check [--changed] [--format human|json|claude-stop]",
      );
    }

    process.exitCode = await harnessCheckCommand(parsed);

    return;
  }

  if (command === "import" && rest.length === 0) {
    await importRepositoryGuidanceCommand();

    return;
  }

  if (command === "skills" && rest.length === 0) {
    await listSeedGuidance();

    return;
  }

  if (command === "skills" && (await handleSkillMaintenance(rest))) {
    return;
  }

  if (await handlePreferenceCommand({ command, arguments: rest })) {
    return;
  }

  if (command === "learn") {
    const options = parseLearnOptions(rest);

    if (options) {
      await learn({ ...options, workingDirectory: process.cwd() });

      return;
    }
  }

  if (command === "doctor" && rest.length === 0) {
    await doctor();

    return;
  }

  if (await handleProfileRepairCommand({ command, arguments: rest })) {
    return;
  }

  if (
    (await handleSkillsMigration({ command, arguments: rest })) ||
    (await handleMigrateCommand({ command, arguments: rest }))
  ) {
    return;
  }

  if (command === "recall") {
    const options = parseRecallOptions(rest);

    if (options !== null) {
      await recallCommand(options);

      return;
    }
  }

  if (await handleNativeCommand({ command, arguments: rest })) {
    return;
  }

  if (command === "run") {
    await runClone(rest);

    return;
  }

  if (command === "task") {
    await taskCommandLine({ arguments: rest });
    return;
  }

  if (command === "eval") {
    if (await handleFourSetupEval(rest)) return;
    if (await handleFixedEval(rest)) return;
    if (await handleWorkflowEval(rest)) return;
    await studyEvalCommand(rest);

    return;
  }

  if (command === "mcp") {
    await serveMcp();

    return;
  }

  if (command === "hook" && rest[0] === "session-end") {
    await runSessionEndHook({ input: await Bun.stdin.text() });

    return;
  }

  if (command === "hook" && rest[0] === "session-start") {
    await runSessionStartHook({ input: await Bun.stdin.text() });

    return;
  }

  if (command === "forget" && rest[0] === "--all") {
    await forgetAll();

    return;
  }

  printUsage();

  if (command !== undefined) {
    process.exitCode = 1;
  }
}

await main(Bun.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Shadowclone could not complete this command";
  console.error(message.length <= 1_000
    ? redactSecrets({ text: message })
    : "Shadowclone could not complete this command. Run shadowclone doctor and inspect learning status.");
  process.exitCode = 1;
});
