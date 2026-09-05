#!/usr/bin/env bun

import { doctor } from "./doctor";
import { forgetAll } from "./forget";
import {
  runSessionEndHook,
  runSessionStartHook,
} from "./hooks";
import { initialize } from "./init";
import { installLiveClone } from "./install";
import { learn } from "./learn";

function printUsage(): void {
  console.log(
    "Usage: shadowclone <init|learn [--deep]|doctor|install|forget --all>",
  );
}

async function main(arguments_: readonly string[]): Promise<void> {
  const [command, ...rest] = arguments_;

  if (command === "init") {
    await initialize();
    return;
  }
  if (
    command === "learn" &&
    (rest.length === 0 || (rest.length === 1 && rest[0] === "--deep"))
  ) {
    await learn({ deep: rest[0] === "--deep" });
    return;
  }
  if (command === "doctor" && rest.length === 0) {
    await doctor();
    return;
  }
  if (command === "install" && rest.length === 0) {
    await installLiveClone();
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
