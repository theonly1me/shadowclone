import { expect, test } from "bun:test";
import type { CorrectionSignal } from "../signal";
import { profileRules } from "./profile";

const signal: CorrectionSignal = {
  kind: "interruption",
  category: "tool:Edit",
  label: "while using Edit",
  sessionId: "session-one",
  timestamp: 1_788_537_600_000,
  origin: {
    id: "github.com/acme",
    directoryName: "github.com--acme",
    promotable: true,
  },
  textRefs: [],
};

test("keeps the first constituent identity when merged wording changes", () => {
  const [first] = profileRules({
    value: {
      rules: [
        {
          title: "Plan first",
          body: "Show the plan before editing.",
          section: "workflow",
        },
      ],
    },
    signals: [signal],
  });
  if (!first) {
    throw new Error("Expected an initial profile rule");
  }

  const [merged] = profileRules({
    value: {
      rules: [
        {
          title: "Present the plan before changing code",
          body: "Show the plan and wait for its resolution before editing.",
          section: "workflow",
          sources: [0],
        },
      ],
    },
    signals: [signal],
    originRules: [first],
  });

  expect(merged?.key).toBe(first.key);
  expect(merged?.title).not.toBe(first.title);
});
