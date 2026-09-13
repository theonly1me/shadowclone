#!/usr/bin/env bun

import packageManifest from "../../package.json";
import { serveMcp } from "../mcp";
import { doctor } from "./doctor";
import { transferEvalCommand } from "./transferEval";
import { forgetAll } from "./forget";
import {
  runSessionEndHook,
  runSessionStartHook,
} from "./hooks";
import { initialize } from "./init";
import { importRepositoryGuidanceCommand } from "./import";
import { handleNativeCommand } from "./native";
import { handlePreferenceCommand } from "./preferences";
import { learn } from "./learn";
import { parseLearnOptions } from "./learnOptions";
import { runClone } from "./run";
import { listSeedGuidance } from "./skills";
import { handleSkillMaintenance } from "./skillMaintenance";
import { runWizard } from "./wizard";

const usage =
  "Usage: shadowclone <init [--advanced]|import|wizard|skills|learn [--deep] [--dry-run] [--apply] [--engine <id>] [--model <id>] [--reasoning-effort <level>] [--max-calls <n>]|learn --session <token>|doctor|install [--agent claude-code|codex|cursor|antigravity|all] [--global|--repo] [--subagent] [--auto-delegate]|uninstall [--agent <agent>] [--global|--repo]|context|sync|run <task>|eval [--repo <path>] [--task <prompt>|--tasks N|--suite-id <id>] [--engine <id>] [--model <id>] [--reasoning-effort <level>] [--repeat N] [--timeout-seconds N] [--eval-id <id>] [--yes] [--json]|mcp|forget --all>";

function printUsage(): void {
  console.log(usage);
  console.log("Preferences: remember [--repo|--global] <text>, history [revision-id], undo <revision-id>, learning enable|disable|status");
  console.log("Skill maintenance: skills configure [--repo|--global], skills list|update|pending, skills show|apply|reject <id>, skills manage <skill-id>, skills disable");
}

function printVersion(): void {
  console.log(packageManifest.version);
}

async function main(arguments_: readonly string[]): Promise<void> {
  const [command, ...rest] = arguments_;

  if (command === "--help" || command === "-h" || command === "help") {
    printUsage();
    return;
  }
  if (command === "--version" || command === "-v") {
    printVersion();
    return;
  }
  if (command === "init") {
    if (rest.length > 1 || (rest.length === 1 && rest[0] !== "--advanced")) {
      printUsage();
      process.exitCode = 1;
      return;
    }
    await initialize({ advanced: rest[0] === "--advanced" });
    return;
  }
  if (command === "import" && rest.length === 0) {
    await importRepositoryGuidanceCommand();
    return;
  }
  if (command === "wizard" && rest.length === 0) {
    await runWizard();
    return;
  }
  if (command === "skills" && rest.length === 0) {
    await listSeedGuidance();
    return;
  }
  if (command === "skills" && await handleSkillMaintenance(rest)) return;
  if (await handlePreferenceCommand({ command, arguments: rest })) return;
  if (command === "learn") {
    const options = parseLearnOptions(rest);
    if (options) {
      await learn(options);
      return;
    }
  }
  if (command === "doctor" && rest.length === 0) {
    await doctor();
    return;
  }
  if (await handleNativeCommand({ command, arguments: rest })) return;
  if (command === "run") {
    await runClone(rest);
    return;
  }
  if (command === "eval") {
    await transferEvalCommand(rest);
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

await main(Bun.argv.slice(2));
