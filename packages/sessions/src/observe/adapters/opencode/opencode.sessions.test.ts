import type { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import type { FileCursor } from "../../types";
import {
  createVersionOneTables,
  createVersionTwoTables,
  insertSession,
  insertVersionOneMessage,
  insertVersionTwoMessage,
  observeOpencode,
  opencodeFixture,
} from "./fixtures";

function userPrompt(options: {
  readonly database: Database;
  readonly sessionId: string;
  readonly id: string;
  readonly createdAt: number;
  readonly text: string;
}): void {
  insertVersionOneMessage({
    database: options.database,
    id: options.id,
    sessionId: options.sessionId,
    createdAt: options.createdAt,
    data: { role: "user", time: { created: options.createdAt } },
    parts: [{ id: `prt_${options.id}`, data: { type: "text", text: options.text } }],
  });
}

test("a session that OpenCode 2.x migrated is read once, from the 2.x tables", async () => {
  const { paths, database } = await opencodeFixture();

  createVersionOneTables(database);
  createVersionTwoTables(database);
  insertSession({ database, table: "session", id: "ses_migrated", createdAt: 10 });
  userPrompt({ database, sessionId: "ses_migrated", id: "msg_old", createdAt: 11, text: "first" });
  insertSession({ database, table: "session_v2", id: "ses_migrated", createdAt: 10 });
  insertVersionTwoMessage({
    database,
    id: "msg_new",
    sessionId: "ses_migrated",
    type: "user",
    seq: 0,
    createdAt: 11,
    data: { text: "first" },
  });
  insertSession({ database, table: "session", id: "ses_legacy", createdAt: 20 });
  userPrompt({
    database,
    sessionId: "ses_legacy",
    id: "msg_legacy",
    createdAt: 21,
    text: "second",
  });
  database.close();

  const batches = await observeOpencode({ paths });

  expect(batches.map((batch) => batch.events.map((event) => event.eventId))).toEqual([
    ["ses_migrated:msg_new"],
    ["ses_legacy:prt_msg_legacy"],
  ]);
});

test("subagent sessions and messages that a fork copied are not learning evidence", async () => {
  const { paths, database } = await opencodeFixture();

  createVersionOneTables(database);
  insertSession({ database, table: "session", id: "ses_parent", createdAt: 10 });
  userPrompt({
    database,
    sessionId: "ses_parent",
    id: "msg_parent",
    createdAt: 11,
    text: "plan it",
  });
  insertSession({
    database,
    table: "session",
    id: "ses_child",
    createdAt: 12,
    parentId: "ses_parent",
  });
  userPrompt({
    database,
    sessionId: "ses_child",
    id: "msg_child",
    createdAt: 13,
    text: "model prompt",
  });
  insertSession({ database, table: "session", id: "ses_fork", createdAt: 30 });
  userPrompt({ database, sessionId: "ses_fork", id: "msg_copied", createdAt: 11, text: "plan it" });
  userPrompt({
    database,
    sessionId: "ses_fork",
    id: "msg_forked",
    createdAt: 31,
    text: "try again",
  });
  database.close();

  const batches = await observeOpencode({ paths });

  expect(batches.map((batch) => batch.events.map((event) => event.eventId))).toEqual([
    ["ses_parent:prt_msg_parent"],
    ["ses_fork:prt_msg_forked"],
  ]);
});

test("an unchanged session is skipped and a session with a new message is read again", async () => {
  const { paths, database } = await opencodeFixture();
  const cursors = new Map<string, FileCursor>();

  createVersionOneTables(database);
  insertSession({ database, table: "session", id: "ses_live", createdAt: 10 });
  userPrompt({ database, sessionId: "ses_live", id: "msg_a", createdAt: 11, text: "first" });

  const observe = async () => {
    const batches = await observeOpencode({
      paths,
      getCursor: (sourcePath) => cursors.get(sourcePath) ?? null,
    });

    for (const batch of batches) {
      cursors.set(batch.sourcePath, batch.cursor);
    }

    return batches.map((batch) => [batch.rescanned, batch.events.length]);
  };

  expect(await observe()).toEqual([[false, 1]]);
  expect(await observe()).toEqual([]);

  userPrompt({ database, sessionId: "ses_live", id: "msg_b", createdAt: 12, text: "second" });

  expect(await observe()).toEqual([[true, 2]]);
  database.close();
});
