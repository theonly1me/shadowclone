import { describe, expect, test } from "bun:test";
import { claudeDriver } from "./claude";
import { codexDriver } from "./codex";
import { fakeEngine } from "./fakeEngine";

function userText(value: unknown): string | null {
  const parsed = JSON.stringify(value);
  const match = /"type":"text","text":"([^"]*)"/.exec(parsed);

  return match?.[1] ?? null;
}

describe("the Claude Code driver", () => {
  test("a message during a turn interrupts it and arrives as a new user turn, and the interrupt does not end the work", async () => {
    const fake = fakeEngine();
    const driver = claudeDriver({
      engine: fake.engine,
      prompt: "fix the parser",
      graceMilliseconds: 10,
    });

    await driver.send("skip the docs");

    expect(fake.written.map((value) => JSON.stringify(value).slice(0, 40))).toEqual([
      expect.stringContaining('"type":"user"'),
      expect.stringContaining('"type":"control_request"'),
    ]);

    fake.emit({ type: "result", subtype: "error_during_execution", is_error: true });
    await fake.writes(3);

    expect(userText(fake.written[2])).toBe("skip the docs");
    expect(driver.busy()).toBe(true);

    fake.emit({ type: "result", subtype: "success", result: "Fixed the parser." });

    expect(await driver.nextTurnEnd()).toEqual({
      outcome: "completed",
      summary: "Fixed the parser.",
    });
    expect(driver.busy()).toBe(false);
    expect(await driver.close()).toBe(0);
  });

  test("a message after the turn ended starts a new turn with no interrupt", async () => {
    const fake = fakeEngine();
    const driver = claudeDriver({
      engine: fake.engine,
      prompt: "fix the parser",
      graceMilliseconds: 10,
    });

    fake.emit({ type: "result", subtype: "success", result: "Done." });
    await driver.nextTurnEnd();
    await driver.send("also update the changelog");

    expect(fake.written.map(userText)).toEqual(["fix the parser", "also update the changelog"]);
    expect(driver.busy()).toBe(true);
  });
});

function codexServer() {
  return fakeEngine({
    onWrite: (value, emit) => {
      if (typeof value !== "object" || value === null || !("method" in value) || !("id" in value)) {
        return;
      }

      const results: Readonly<Record<string, unknown>> = {
        initialize: {},
        "thread/start": { thread: { id: "thread-1" } },
        "turn/start": { turn: { id: "turn-2" } },
        "turn/steer": {},
      };

      emit({ id: value.id, result: results[String(value.method)] ?? {} });
    },
  });
}

function methods(written: readonly unknown[]): readonly string[] {
  return written.flatMap((value) =>
    typeof value === "object" && value !== null && "method" in value ? [String(value.method)] : [],
  );
}

describe("the Codex driver", () => {
  test("a message during a turn steers that turn, and a message after it ends starts a new turn", async () => {
    const fake = codexServer();
    const driver = codexDriver({
      engine: fake.engine,
      prompt: "fix the parser",
      thread: { cwd: "/work" },
      graceMilliseconds: 10,
    });

    await fake.writes(4);
    fake.emit({ method: "turn/started", params: { turn: { id: "turn-1" } } });
    await driver.send("skip the docs");

    const steer = fake.written.find(
      (value) =>
        typeof value === "object" &&
        value !== null &&
        "method" in value &&
        value.method === "turn/steer",
    );

    expect(JSON.stringify(steer)).toContain('"expectedTurnId":"turn-1"');

    fake.emit({
      method: "item/completed",
      params: { item: { type: "agentMessage", text: "Fixed it." } },
    });
    fake.emit({ method: "turn/completed", params: { turn: { status: "completed" } } });

    expect(await driver.nextTurnEnd()).toEqual({ outcome: "completed", summary: "Fixed it." });

    await driver.send("also update the changelog");

    expect(methods(fake.written)).toEqual([
      "initialize",
      "initialized",
      "thread/start",
      "turn/start",
      "turn/steer",
      "turn/start",
    ]);
  });
});
