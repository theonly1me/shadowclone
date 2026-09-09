import { expect, test } from "bun:test";
import { parseLearnOptions } from "./learnOptions";

test("parses deep review modes", () => {
  expect(parseLearnOptions(["--deep", "--dry-run"])).toEqual({
    deep: true,
    dryRun: true,
    apply: false,
  });
  expect(parseLearnOptions(["--deep", "--apply"])).toEqual({
    deep: true,
    dryRun: false,
    apply: true,
  });
});

test("rejects invalid apply combinations before learning", () => {
  expect(() => parseLearnOptions(["--apply"])).toThrow("requires --deep");
  expect(() => parseLearnOptions(["--deep", "--dry-run", "--apply"]))
    .toThrow("cannot be combined");
  expect(parseLearnOptions(["--unknown"])).toBeNull();
});
