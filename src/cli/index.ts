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
import { installLiveClone } from "./install";
import { uninstallLiveClone } from "./uninstall";
import { learn } from "./learn";
import { parseLearnOptions } from "./learnOptions";
import { runClone } from "./run";
import { listSeedGuidance } from "./skills";
import { runWizard } from "./wizard";

const usage =
  "Usage: shadowclone <init|import|wizard|skills|learn [--deep] [--dry-run] [--apply]|doctor|install [--auto-delegate]|uninstall|run <task>|eval [--repo <path>] [--tasks N] [--engine <id>] [--model <id>] [--repeat N] [--timeout-seconds N] [--eval-id <id>] [--yes] [--json]|mcp|forget --all>";

function printUsage(): void {
  console.log(usage);
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
    await initialize();
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
  if (command === "install" && rest.length === 0) {
    await installLiveClone();
    return;
  }
  if (command === "install" && rest.length === 1 && rest[0] === "--auto-delegate") {
    await installLiveClone({ autoDelegate: true });
    return;
  }
  if (command === "uninstall" && rest.length === 0) {
    await uninstallLiveClone();
    return;
  }
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
