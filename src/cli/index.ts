#!/usr/bin/env bun

import { forgetAll } from "./forget";
import { initialize } from "./init";
import { learn } from "./learn";

function printUsage(): void {
  console.log(
    "Usage: shadowclone <init|learn|forget --all>",
  );
}

async function main(arguments_: readonly string[]): Promise<void> {
  const [command, ...rest] = arguments_;

  if (command === "init") {
    await initialize();
    return;
  }
  if (command === "learn") {
    await learn();
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
