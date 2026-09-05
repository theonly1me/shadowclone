import { expect, test } from "bun:test";
import type { CorrectionSignal } from "../signal";
import { buildProfileRules } from "./rules";

test("keeps a tool-family denial advisory", () => {
  const signal: CorrectionSignal = {
    kind: "permission-denied",
    category: "tool:Bash",
    label: "Bash",
    sessionId: "session",
    timestamp: 0,
    origin: {
      id: "isolated:repo",
      directoryName: "isolated--repo",
      promotable: false,
    },
    textRefs: [],
  };

  const [rule] = buildProfileRules({
    events: [],
    signals: [signal],
    origins: new Map(),
  });

  expect(rule?.title).toBe("Requests confirmation after refusing Bash");
  expect(rule?.body).toContain("do not treat the whole tool family as blocked");
  expect(rule?.section).toBe("boundaries");
});
