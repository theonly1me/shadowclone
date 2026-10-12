import { expect, test } from "bun:test";
import { environmentFile } from "@shadowclone/environment";
import { environmentFixture } from "@shadowclone/environment/testing";
import { runPreferenceTool } from "./preferences";

test("MCP requires explicit scope and records redacted preferences", async () => {
  const setup = await environmentFixture();
  const secret = `sk-ant-${"A".repeat(90)}`;

  expect(
    (
      await runPreferenceTool({
        ...setup,
        params: {
          name: "shadowclone_remember",
          arguments: { text: "Use Bun" },
        },
      })
    )?.isError,
  ).toBeTrue();
  expect(
    (
      await runPreferenceTool({
        ...setup,
        params: {
          name: "shadowclone_remember",
          arguments: { text: `Never expose ${secret}`, scope: "global" },
        },
      })
    )?.isError,
  ).toBeFalse();
  expect(await Bun.file(environmentFile(setup.paths)).text()).not.toContain(secret);

  const history = await runPreferenceTool({
    ...setup,
    params: { name: "shadowclone_history", arguments: {} },
  });

  expect(history?.isError).toBeFalse();
  expect(history?.content[0]?.text).not.toContain("Never expose");
});
