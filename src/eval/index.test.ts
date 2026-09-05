import { expect, test } from "bun:test";
import { scoreReplay } from "./index";

test("scores the four replay dimensions independently", () => {
  const score = scoreReplay({
    actual: {
      tools: ["Read", "Edit", "Bash"],
      verificationSteps: ["typecheck", "test"],
      filesTouched: ["src/main.ts", "src/main.test.ts"],
      plannedBeforeEditing: true,
    },
    clone: {
      tools: ["Read", "Edit"],
      verificationSteps: ["test"],
      filesTouched: ["src/main.ts"],
      plannedBeforeEditing: false,
    },
  });

  expect(score.tools).toBeCloseTo(2 / 3);
  expect(score.verification).toBe(0.5);
  expect(score.files).toBe(0.5);
  expect(score.planning).toBe(0);
  expect(score.total).toBeCloseTo(5 / 12);
});

test("gives an exact replay a perfect score", () => {
  const behavior = {
    tools: ["Read"],
    verificationSteps: ["test"],
    filesTouched: ["src/main.ts"],
    plannedBeforeEditing: true,
  };

  expect(scoreReplay({ actual: behavior, clone: behavior }).total).toBe(1);
});
