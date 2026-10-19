import { expect, test } from "bun:test";
import { terminalTyper } from "./terminal";

test("tmux gets the text as literal keys, then Enter, on the recorded socket", async () => {
  const commands: (readonly string[])[] = [];
  const type = terminalTyper(async (command) => {
    commands.push(command);

    return 0;
  });

  expect(
    await type({
      surface: { kind: "tmux", pane: "%3", socket: "/tmp/tmux-1/default" },
      text: "go\nnow",
    }),
  ).toBe(true);
  expect(commands).toEqual([
    ["tmux", "-S", "/tmp/tmux-1/default", "send-keys", "-t", "%3", "-l", "go now"],
    ["tmux", "-S", "/tmp/tmux-1/default", "send-keys", "-t", "%3", "Enter"],
  ]);
});

test("a failed send stops before Enter", async () => {
  const commands: (readonly string[])[] = [];
  const type = terminalTyper(async (command) => {
    commands.push(command);

    return 1;
  });

  expect(await type({ surface: { kind: "cmux", surface: "S1", socket: null }, text: "go" })).toBe(
    false,
  );
  expect(commands).toHaveLength(1);
  expect(commands[0]?.slice(1)).toEqual(["send", "--surface", "S1", "go"]);
});
