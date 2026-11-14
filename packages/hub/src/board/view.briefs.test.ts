import { describe, expect, test } from "bun:test";
import type { BoardBrief } from "@shadowclone/live/board";
import { installFakeDocument } from "./fakeDocument";
import type { FleetSession } from "./schema";
import { headline, sessionGroups } from "./view/model";
import { sessionCard, sessionRow, sessionView } from "./view/session";
import { emptyState, type BoardActions } from "./view/state";

const scriptText = "<script>alert(1)</script>";

function session(options: {
  readonly id: string;
  readonly state: FleetSession["state"];
  readonly brief?: BoardBrief;
}): FleetSession {
  return {
    id: options.id,
    engine: "claude",
    state: options.state,
    repository: "you/app",
    branch: "main",
    updatedAt: "2026-10-18T11:30:00Z",
    message: `Raw message of ${options.id}.`,
    node: "studio",
    ...(options.brief === undefined ? {} : { brief: options.brief }),
  };
}

const question: BoardBrief = {
  name: `Rename ${scriptText}`,
  goal: "The owner wants the parser renamed.",
  done: "The agent renamed it.",
  kind: "question",
  question: "Keep the old name?",
  options: ["Keep it", "<b>Remove it</b>"],
};

const finished: BoardBrief = {
  ...question,
  name: "Speed up tests",
  kind: "finished",
  question: null,
  options: [],
};

function actionsThatRecord(sent: { id: string; text: string }[]): BoardActions {
  const ignore = () => undefined;

  return {
    refresh: ignore,
    open: ignore,
    send: (entry) => sent.push(entry),
    startPairing: ignore,
    cancelPairing: ignore,
    choose: ignore,
    unpair: ignore,
    fullscreen: ignore,
  };
}

describe("briefs on the session board", () => {
  test("a question or blocked brief needs you, a finished brief is ready, and no brief keeps today's group", () => {
    const groups = sessionGroups([
      session({ id: "live-00000001", state: "idle", brief: question }),
      session({ id: "live-00000002", state: "idle", brief: finished }),
      session({ id: "live-00000003", state: "idle" }),
      session({ id: "live-00000004", state: "needs-you" }),
      session({ id: "live-00000005", state: "idle", brief: { ...finished, kind: "blocked" } }),
    ]);

    expect(groups.needsYou.map((entry) => entry.id)).toEqual([
      "live-00000001",
      "live-00000004",
      "live-00000005",
    ]);
    expect(groups.readyForYou.map((entry) => entry.id)).toEqual(["live-00000002"]);
    expect(groups.yourTurn.map((entry) => entry.id)).toEqual(["live-00000003"]);
    expect(
      headline({
        kind: "fleet",
        hub: "studio",
        nodes: [],
        pairs: [],
        sessions: [session({ id: "live-00000002", state: "idle", brief: finished })],
      }),
    ).toEqual(["1 session is ready for you."]);
  });

  test("a question card shows each option as a button, and writes brief text as text", () => {
    const { created } = installFakeDocument();
    const state = emptyState();
    const view = sessionView({
      session: session({ id: "live-00000001", state: "idle", brief: question }),
      state,
      showNode: false,
    });

    sessionCard({ view, state, actions: actionsThatRecord([]) });

    const options = created.filter(
      (node) => node.className.includes("option") && node.tagName === "BUTTON",
    );
    const textOf = (className: string) =>
      created.find((node) => node.className.includes(className))?.textContent;

    expect(options.map((node) => node.textContent)).toEqual(["Keep it", "<b>Remove it</b>"]);
    expect(textOf("brief-name")).toBe(`Rename ${scriptText}`);
    expect(textOf("brief-need")).toBe("Keep the old name?");
    expect(textOf("brief-label")).toBe("Summary by a model");
    expect(textOf("loud")).toBe("Raw message of live-00000001.");
    expect(created.filter((node) => node.tagName === "TEXTAREA")).toHaveLength(1);
    expect(created.filter((node) => node.tagName === "SCRIPT" || node.tagName === "B")).toEqual([]);
    expect(created.filter((node) => Object.hasOwn(node, "innerHTML"))).toEqual([]);
  });

  test("a tap on an option sends that option text to the session", () => {
    const { created } = installFakeDocument();
    const state = emptyState();
    const sent: { id: string; text: string }[] = [];
    const view = sessionView({
      session: session({ id: "live-00000001", state: "idle", brief: question }),
      state,
      showNode: false,
    });

    sessionCard({ view, state, actions: actionsThatRecord(sent) });
    created
      .find((node) => node.tagName === "BUTTON" && node.textContent === "<b>Remove it</b>")
      ?.dispatch("click");

    expect(sent).toEqual([{ id: "live-00000001", text: "<b>Remove it</b>" }]);
  });

  test("a row shows the brief name and goal above the raw message, and a row without a brief shows only the message", () => {
    const { created } = installFakeDocument();
    const state = emptyState();
    const actions = actionsThatRecord([]);
    const rowText = (entry: FleetSession) => {
      const before = created.length;

      sessionRow({
        view: sessionView({ session: entry, state, showNode: false }),
        state,
        actions,
        extra: [],
      });

      return (
        created.slice(before).find((node) => node.className === "row-toggle")?.textContent ?? ""
      );
    };

    expect(rowText(session({ id: "live-00000002", state: "idle", brief: finished }))).toContain(
      "Ready for youyou/appmain",
    );
    expect(rowText(session({ id: "live-00000002", state: "idle", brief: finished }))).toContain(
      "Speed up testsThe owner wants the parser renamed.It finished. Check the result.Summary by a modelRaw message of live-00000002.",
    );
    const before = created.length;
    const plain = rowText(session({ id: "live-00000003", state: "idle" }));

    expect(plain).toStartWith("Your turnyou/appmain");
    expect(plain).toEndWith("Raw message of live-00000003.");
    expect(created.slice(before).filter((node) => node.className.includes("brief"))).toEqual([]);
  });
});
