import type { Stack } from "../types";
import { dotnetStack, goStack, gradleStack, mavenStack, rustStack } from "./compiled";
import { javascriptStack } from "./javascript";
import { lintStacks } from "./linters";
import { pythonStack } from "./python";

export const allStacks: readonly Stack[] = [
  javascriptStack,
  pythonStack,
  goStack,
  rustStack,
  mavenStack,
  gradleStack,
  dotnetStack,
  ...lintStacks,
];
