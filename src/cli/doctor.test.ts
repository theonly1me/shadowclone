import { expect, test } from "bun:test";
import { renderProviderSupport } from "./doctor";

test("reports provider support as three independent levels", () => {
  expect(renderProviderSupport()).toEqual([
    "claude-code: observe=yes, distill=yes, dispatch=yes",
    "codex: observe=yes, distill=yes, dispatch=no",
    "cursor: observe=yes, distill=yes, dispatch=no",
    "antigravity: observe=yes, distill=no, dispatch=no",
  ]);
});
