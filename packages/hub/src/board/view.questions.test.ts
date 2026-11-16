import { describe, expect, test } from "bun:test";
import type { BoardBrief, BoardQuestion } from "@shadowclone/live/board";
import { installFakeDocument, type FakeElement } from "./fakeDocument";
import type { FleetSession } from "./schema";
import { sessionCard, sessionRow, sessionView } from "./view/session";
import { emptyState } from "./view/state";
import { recordingActions } from "./viewActions";

const scriptText = "<script>alert(1)</script>";

const question: BoardQuestion = {
  id: "qabc123",
  text: `Keep the old flag name for one release? ${scriptText}`,
  options: ["Keep it", "<b>Remove it now</b>", "Ask the team"],
  recommended: "Keep it",
};

const questionBrief: BoardBrief = {
  name: "Rename the flag",
  goal: "The owner wants a new flag name.",
  done: "The agent renamed the flag.",
  kind: "question",
  question: "Keep the old name?",
  options: ["Brief option one", "Brief option two"],
};

function asking(options: { readonly brief?: BoardBrief } = {}): FleetSession {
  return {
    id: "live-0000000c",
    engine: "codex",
    state: "needs-you",
    repository: "you/app",
    branch: "feat/flags",
    updatedAt: "2026-10-18T11:30:00Z",
    message: "Question: Keep the old flag name for one release?",
    node: "studio",
    question,
    ...(options.brief === undefined ? {} : { brief: options.brief }),
  };
}

function drawCard(session: FleetSession) {
  const { created } = installFakeDocument();
  const state = emptyState();
  const recording = recordingActions();

  sessionCard({
    view: sessionView({ session, state, showNode: false }),
    state,
    actions: recording.actions,
  });

  return { created, ...recording };
}

function buttons(created: readonly FakeElement[]): FakeElement[] {
  return created.filter((node) => node.tagName === "BUTTON" && node.className.includes("option"));
}

describe("an open question on the session board", () => {
  test("a card shows the question text and one button for each option, with the recommended mark", () => {
    const { created } = drawCard(asking());

    expect(created.find((node) => node.className === "question-text")?.textContent).toBe(
      question.text,
    );
    expect(buttons(created).map((node) => node.textContent)).toEqual([
      "Keep itRecommended",
      "<b>Remove it now</b>",
      "Ask the team",
    ]);
    expect(buttons(created).map((node) => node.className.includes("recommended"))).toEqual([
      true,
      false,
      false,
    ]);
  });

  test("question text renders as text, and no element comes from it", () => {
    const { created } = drawCard(asking());

    expect(created.filter((node) => node.tagName === "SCRIPT" || node.tagName === "B")).toEqual([]);
    expect(created.filter((node) => Object.hasOwn(node, "innerHTML"))).toEqual([]);
  });

  test("a tap on an option answers the question with its id and the option text, and sends nothing", () => {
    const { created, sent, answered } = drawCard(asking());

    buttons(created)
      .find((node) => node.textContent === "<b>Remove it now</b>")
      ?.dispatch("click");

    expect(answered).toEqual([
      { id: "live-0000000c", question: "qabc123", text: "<b>Remove it now</b>" },
    ]);
    expect(sent).toEqual([]);
  });

  test("the text box answers the question with the typed text", () => {
    const { created, sent, answered } = drawCard(asking());
    const field = created.find((node) => node.tagName === "TEXTAREA");
    const form = created.find((node) => node.tagName === "FORM");

    if (field === undefined || form === undefined) {
      throw new Error("The card has no answer box.");
    }

    field.value = "Keep it for two releases";
    form.dispatch("submit");

    expect(answered).toEqual([
      { id: "live-0000000c", question: "qabc123", text: "Keep it for two releases" },
    ]);
    expect(sent).toEqual([]);
  });

  test("a session with a question shows one set of buttons and no terminal hint", () => {
    const { created } = drawCard(asking({ brief: questionBrief }));
    const allText = created.map((node) => node.textContent).join("\n");

    expect(buttons(created)).toHaveLength(3);
    expect(created.filter((node) => node.tagName === "TEXTAREA")).toHaveLength(1);
    expect(allText).not.toContain("Brief option one");
    expect(allText).not.toContain("Answer it in the terminal");
  });

  test("a closed row shows the question and its buttons outside the row toggle", () => {
    const { created } = installFakeDocument();
    const state = emptyState();
    const { actions, answered } = recordingActions();
    sessionRow({
      view: sessionView({ session: asking(), state, showNode: false }),
      state,
      actions,
      extra: [],
    });
    const row = created.find((node) => node.className === "row");
    const toggle = created.find((node) => node.className === "row-toggle");

    buttons(created)
      .find((node) => node.textContent === "Ask the team")
      ?.dispatch("click");

    expect(state.opened).toBeNull();
    expect(toggle?.all().filter((node) => node.className.includes("option"))).toEqual([]);
    expect(row?.all().filter((node) => node.className === "question-text")).toHaveLength(1);
    expect(answered).toEqual([{ id: "live-0000000c", question: "qabc123", text: "Ask the team" }]);
  });
});
