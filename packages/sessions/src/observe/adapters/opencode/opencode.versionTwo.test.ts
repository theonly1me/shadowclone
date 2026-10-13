import { expect, test } from "bun:test";
import { parseTextRef } from "../../types";
import {
  createVersionTwoTables,
  insertSession,
  insertVersionTwoMessage,
  learningTexts,
  observeOpencode,
  opencodeFixture,
  plantedSecret,
} from "./fixtures";

test("OpenCode 2.x learning text holds only user messages and assistant text", async () => {
  const { paths, database } = await opencodeFixture();

  createVersionTwoTables(database);
  insertSession({ database, table: "session_v2", id: "ses_two", createdAt: 2_000 });

  const messages = [
    {
      type: "user",
      data: { text: `use ${plantedSecret} for staging`, files: [], agents: [], skills: [] },
    },
    { type: "synthetic", data: { text: "Called the Read tool with private notes" } },
    { type: "skill", data: { skill: "review", name: "review", text: "skill body text" } },
    {
      type: "shell",
      data: { shellID: "sh_1", command: "cat .env", status: "completed", output: plantedSecret },
    },
    {
      type: "assistant",
      data: {
        agent: "build",
        model: { id: "model", providerID: "provider" },
        content: [
          { type: "reasoning", text: "reasoning must never be distilled" },
          {
            type: "tool",
            id: "call_2",
            name: "read",
            state: { status: "completed", input: {}, content: [] },
          },
          { type: "text", text: "Staging uses the new key." },
        ],
      },
    },
    { type: "idle", data: { outcome: "interrupted" } },
  ];

  messages.forEach((message, seq) => {
    insertVersionTwoMessage({
      database,
      id: `msg_${seq}`,
      sessionId: "ses_two",
      type: message.type,
      seq,
      createdAt: 2_100 + seq,
      data: { ...message.data, time: { created: 2_100 + seq } },
    });
  });
  database.close();

  const [batch] = await observeOpencode({ paths });

  expect(batch?.events.map((event) => event.kind)).toEqual([
    "user-prompt",
    "thinking",
    "tool-call",
    "assistant-text",
    "interruption",
  ]);
  expect(batch?.events.find((event) => event.kind === "tool-call")?.tool).toEqual({
    toolUseId: "call_2",
    name: "read",
  });
  expect(batch?.events.every((event) => event.cwd === "/work/repository")).toBeTrue();
  expect(await learningTexts({ paths, events: batch?.events ?? [] })).toEqual([
    "user-prompt: use sk-...[redacted:llm-api-key] for staging",
    "assistant-text: Staging uses the new key.",
  ]);
});

test("a stored row pointer cannot name another table, a SQL fragment, or another file", async () => {
  const { paths, database } = await opencodeFixture();

  createVersionTwoTables(database);
  insertSession({ database, table: "session_v2", id: "ses_ref", createdAt: 1 });
  insertVersionTwoMessage({
    database,
    id: "msg_ref",
    sessionId: "ses_ref",
    type: "user",
    seq: 0,
    createdAt: 2,
    data: { text: "readable text" },
  });
  database.close();

  const [batch] = await observeOpencode({ paths });
  const [prompt] = batch?.events ?? [];

  if (prompt?.textRef?.type !== "sqlite-row") {
    throw new Error("Expected a row pointer for the user message");
  }

  expect(await learningTexts({ paths, events: [prompt] })).toEqual(["user-prompt: readable text"]);

  expect(parseTextRef({ ...prompt.textRef, table: "session_v2" })).toBeNull();
  expect(
    parseTextRef({ ...prompt.textRef, jsonPath: ["text') FROM session_message --"] }),
  ).toBeNull();

  expect(
    await learningTexts({
      paths: { ...paths, opencodeDatabaseFile: `${paths.opencodeDataDirectory}/other.db` },
      events: [prompt],
    }),
  ).toEqual(["user-prompt: "]);
});
