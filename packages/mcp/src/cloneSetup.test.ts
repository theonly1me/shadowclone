import { expect, test } from "bun:test";
import { projectPaths } from "@shadowclone/core";
import { createCloneSetupTool } from "./cloneSetup";

test("the clone setup tool refuses a token argument, so a token never passes through the agent", async () => {
  const tool = createCloneSetupTool({ cwd: process.cwd(), paths: projectPaths });
  const result = await tool.run({
    name: "shadowclone_clone_setup",
    arguments: { operation: "setup", repository: "sample/project", token: "synthetic-token" },
  });

  expect(result).toEqual({
    content: [
      {
        type: "text",
        text: "Use operation skills, setup, or status. Tokens go in the secrets file, never here.",
      },
    ],
    isError: true,
  });
});

test("the clone setup tool ignores calls for other tools", async () => {
  const tool = createCloneSetupTool({ cwd: process.cwd(), paths: projectPaths });

  expect(
    await tool.run({ name: "shadowclone_bot", arguments: { operation: "status" } }),
  ).toBeNull();
});
