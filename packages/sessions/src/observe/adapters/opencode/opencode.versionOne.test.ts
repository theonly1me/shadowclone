import { expect, test } from "bun:test";
import { openEventIndex } from "../../../eventIndex";
import {
  createVersionOneTables,
  insertSession,
  insertVersionOneMessage,
  learningTexts,
  observeOpencode,
  opencodeFixture,
  plantedSecret,
} from "./fixtures";

const injectedFile = "Called the Read tool with the following input: private notes";
const hiddenThought = "reasoning must never be distilled";

test("OpenCode 1.x learning text holds only typed user text and assistant text", async () => {
  const { paths, database } = await opencodeFixture();

  createVersionOneTables(database);
  insertSession({ database, table: "session", id: "ses_one", createdAt: 1_000 });
  insertVersionOneMessage({
    database,
    id: "msg_user",
    sessionId: "ses_one",
    createdAt: 1_100,
    data: { role: "user", time: { created: 1_100 }, agent: "build" },
    parts: [
      { id: "prt_typed", data: { type: "text", text: `deploy with ${plantedSecret}` } },
      { id: "prt_file", data: { type: "text", text: injectedFile, synthetic: true } },
      { id: "prt_hidden", data: { type: "text", text: "shown but not sent", ignored: true } },
    ],
  });
  insertVersionOneMessage({
    database,
    id: "msg_assistant",
    sessionId: "ses_one",
    createdAt: 1_200,
    data: { role: "assistant", time: { created: 1_200, completed: 1_300 }, parentID: "msg_user" },
    parts: [
      {
        id: "prt_01_reasoning",
        data: { type: "reasoning", text: hiddenThought, time: { start: 1_200 } },
      },
      {
        id: "prt_02_tool",
        data: {
          type: "tool",
          callID: "call_1",
          tool: "bash",
          state: { status: "completed", input: {}, output: `token ${plantedSecret}` },
        },
      },
      { id: "prt_03_answer", data: { type: "text", text: "Deployed the focused change." } },
    ],
  });
  database.close();

  const [batch, ...extra] = await observeOpencode({ paths });

  expect(extra).toHaveLength(0);
  expect(batch?.events.map((event) => event.kind)).toEqual([
    "user-prompt",
    "thinking",
    "tool-call",
    "assistant-text",
  ]);
  expect(batch?.events.find((event) => event.kind === "tool-call")?.tool).toEqual({
    toolUseId: "call_1",
    name: "bash",
  });
  expect(await learningTexts({ paths, events: batch?.events ?? [] })).toEqual([
    "user-prompt: deploy with sk-...[redacted:llm-api-key]",
    "assistant-text: Deployed the focused change.",
  ]);

  const index = await openEventIndex(paths.indexDatabase);

  if (batch) {
    index.saveBatch(batch);
  }
  index.close();

  const indexText = new TextDecoder().decode(
    new Uint8Array(await Bun.file(paths.indexDatabase).arrayBuffer()),
  );

  expect(indexText).not.toContain(plantedSecret);
  expect(indexText).not.toContain("deploy with");
});

test("OpenCode 1.x records a stopped response as an interruption", async () => {
  const { paths, database } = await opencodeFixture();

  createVersionOneTables(database);
  insertSession({ database, table: "session", id: "ses_stop", createdAt: 1_000 });
  insertVersionOneMessage({
    database,
    id: "msg_ask",
    sessionId: "ses_stop",
    createdAt: 1_100,
    data: { role: "user", time: { created: 1_100 } },
    parts: [{ id: "prt_ask", data: { type: "text", text: "rename the module" } }],
  });
  insertVersionOneMessage({
    database,
    id: "msg_stopped",
    sessionId: "ses_stop",
    createdAt: 1_200,
    data: {
      role: "assistant",
      time: { created: 1_200, completed: 1_250 },
      error: { name: "MessageAbortedError", data: { message: "Aborted" } },
    },
    parts: [
      {
        id: "prt_edit",
        data: {
          type: "tool",
          callID: "call_edit",
          tool: "edit",
          state: { status: "error", input: {}, error: "Tool execution aborted" },
        },
      },
    ],
  });
  database.close();

  const [batch] = await observeOpencode({ paths });

  expect(batch?.events.map((event) => [event.kind, event.isError])).toEqual([
    ["user-prompt", false],
    ["tool-call", true],
    ["interruption", true],
  ]);
  expect(batch?.events.at(-1)?.parentEventId).toBe("ses_stop:prt_edit");
});
