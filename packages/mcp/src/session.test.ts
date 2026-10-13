import { expect, test } from "bun:test";
import { projectPaths } from "@shadowclone/core";
import { createSessionTool } from "./session";

test("the session tool refuses a token argument, so a token never passes through the agent", async () => {
  const tool = createSessionTool({ cwd: process.cwd(), paths: projectPaths });
  const result = await tool.run({
    name: "shadowclone_session",
    arguments: { operation: "setup", repository: "sample/project", token: "synthetic-token" },
  });

  expect(result).toEqual({
    content: [
      {
        type: "text",
        text: "Use operation skills, setup, status, or start. Tokens go in the secrets file, never here.",
      },
    ],
    isError: true,
  });
});

test("the session tool ignores calls for other tools", async () => {
  const tool = createSessionTool({ cwd: process.cwd(), paths: projectPaths });

  expect(
    await tool.run({ name: "shadowclone_bot", arguments: { operation: "status" } }),
  ).toBeNull();
});
