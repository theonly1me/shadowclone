import { expect, test } from "bun:test";
import { renderAgent } from "./index";

test("renders a dispatchable agent with the delivered context", () => {
  const profile = ["# Shadowclone", "", "Use the shadowclone-work skill for delegated work."].join("\n");
  const agent = renderAgent({ profile });

  expect(agent).toContain("name: shadowclone");
  expect(agent).toContain(profile);
  expect(() => renderAgent({ profile, name: "Not Valid" })).toThrow("Agent name must use lowercase letters");
});
