import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createSchema } from "../../index/schema";
import { EventIndex } from "../../index/store";
import type { IndexedEvent } from "../../index";
import { resolveEventRepositories } from "./resolve";

function event(cwd: string): IndexedEvent {
  return {
    id: 1,
    sourcePath: "/transcripts/session.jsonl",
    source: "claude-code",
    sessionId: "session-one",
    eventId: "event-one",
    parentEventId: null,
    timestamp: 1,
    cwd,
    gitBranch: null,
    kind: "user-prompt",
    tool: null,
    isError: false,
    textRef: null,
  };
}

function openIndex(): EventIndex {
  const database = new Database(":memory:", { create: true });
  createSchema(database);
  return new EventIndex(database);
}

test("a working directory keeps the owner it was first resolved under", async () => {
  const index = openIndex();
  const events = [event("/work/platform")];

  const first = await resolveEventRepositories({
    events,
    enabled: true,
    readRemote: async () => "git@github.com:first-owner/platform.git",
    bindings: index,
  });
  const second = await resolveEventRepositories({
    events,
    enabled: true,
    readRemote: async () => "git@github.com:second-owner/platform.git",
    bindings: index,
  });

  expect(first.get("/work/platform")?.origin.id).toBe("github.com/first-owner");
  expect(second.get("/work/platform")?.origin.id).toBe(
    "github.com/first-owner",
  );
  index.close();
});

test("without a binding store the current remote wins every time", async () => {
  const events = [event("/work/platform")];

  const second = await resolveEventRepositories({
    events,
    enabled: true,
    readRemote: async () => "git@github.com:second-owner/platform.git",
  });

  expect(second.get("/work/platform")?.origin.id).toBe(
    "github.com/second-owner",
  );
});

test("a binding is recorded the first time a directory resolves", async () => {
  const index = openIndex();

  expect(index.getOriginBinding("/work/platform")).toBeNull();
  await resolveEventRepositories({
    events: [event("/work/platform")],
    enabled: true,
    readRemote: async () => "git@github.com:first-owner/platform.git",
    bindings: index,
  });

  expect(index.getOriginBinding("/work/platform")?.origin.id).toBe(
    "github.com/first-owner",
  );
  index.close();
});

test("a directory resolved without git consent binds as isolated and stays isolated", async () => {
  const index = openIndex();
  const events = [event("/work/platform")];

  const withoutConsent = await resolveEventRepositories({
    events,
    enabled: false,
    readRemote: async () => "git@github.com:owner/platform.git",
    bindings: index,
  });

  expect(withoutConsent.get("/work/platform")?.origin.promotable).toBeFalse();
  expect(index.getOriginBinding("/work/platform")?.origin.promotable).toBeFalse();
  index.close();
});
