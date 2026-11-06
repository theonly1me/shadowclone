import { expect, test } from "bun:test";
import type { DiffFile } from "./collect";
import { maximumPartBytes, reviewParts } from "./shards";

function file(options: { readonly path: string; readonly bytes: number }): DiffFile {
  return { path: options.path, deleted: false, text: "x".repeat(options.bytes), changedLines: 1, ranges: [[1, 1]], added: [] };
}

test("a 105 KB diff splits into parts of at most 40 KB, and each file reaches exactly one part", () => {
  const files = ["a", "b", "c", "d", "e", "f", "g"].map((name) => file({ path: `src/${name}.ts`, bytes: 15_000 }));
  const parts = reviewParts({ files, candidates: [] });

  expect(parts.map((part) => part.files.reduce((total, entry) => total + entry.text.length, 0))).toEqual([30_000, 30_000, 30_000, 15_000]);
  expect(parts.every((part) => part.files.reduce((total, entry) => total + entry.text.length, 0) <= maximumPartBytes)).toBe(true);
  expect(parts.flatMap((part) => part.files.map((entry) => entry.path))).toEqual(files.map((entry) => entry.path));
});
