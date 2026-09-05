import { expect, test } from "bun:test";
import {
  renderEngineSelection,
  renderProviderSupport,
} from "./doctor";

test("reports provider support as three independent levels", () => {
  expect(renderProviderSupport()).toEqual([
    "claude-code: observe=yes, distill=yes, dispatch=yes",
    "codex: observe=yes, distill=yes, dispatch=no",
    "cursor: observe=yes, distill=yes, dispatch=no",
    "antigravity: observe=yes, distill=no, dispatch=no",
  ]);
});

test("reports managed distillation policy separately from authentication", () => {
  expect(
    renderEngineSelection({
      distillation: "disabled",
      selectedEngine: null,
    }),
  ).toBe("Deep distillation is disabled by managed policy.");
  expect(
    renderEngineSelection({
      distillation: "local-only",
      selectedEngine: null,
    }),
  ).toBe(
    "Deep distillation is restricted to local engines, which are not implemented.",
  );
});
