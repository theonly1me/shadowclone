import { describe, expect, test } from "bun:test";
import path from "node:path";

const viewFolder = path.join(import.meta.dir, "view");

const htmlSinks = ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "DOMParser"];

describe("the board view source", () => {
  test("no view file writes session text as HTML", async () => {
    const files = await Array.fromAsync(new Bun.Glob("**/*.ts").scan({ cwd: viewFolder }));
    const findings: string[] = [];

    for (const file of files) {
      const text = await Bun.file(path.join(viewFolder, file)).text();

      findings.push(
        ...htmlSinks.filter((sink) => text.includes(sink)).map((sink) => `${file}: ${sink}`),
      );
    }

    expect(files.length).toBeGreaterThan(5);
    expect(findings).toEqual([]);
  });
});
