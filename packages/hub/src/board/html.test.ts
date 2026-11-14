import { describe, expect, test } from "bun:test";
import os from "node:os";
import path from "node:path";
import { generatedModule } from "./bundle";
import { boardHtml } from "./html";

describe("the generated board document", () => {
  test("is one self-contained HTML5 document with inline script and style", () => {
    expect(boardHtml.startsWith("<!doctype html>\n<html")).toBe(true);
    expect(boardHtml.endsWith("</html>")).toBe(true);
    expect(boardHtml.split("<html").length - 1).toBe(1);
    expect(boardHtml.split('<script type="module">').length - 1).toBe(1);
    expect(boardHtml).not.toMatch(/<script[^>]+src=|<link\b/);
  });

  test("holds no path of the build machine", () => {
    expect(boardHtml).not.toContain(os.homedir());
    expect(boardHtml).not.toContain(path.resolve(import.meta.dir, "../../../.."));
  });

  test("stays under the growth guard of 400,000 characters", () => {
    expect(boardHtml.length).toBeLessThan(400_000);
  });

  test("the module escapes each character outside printable ASCII and each dollar sign", () => {
    const input = ["a", String.fromCharCode(0x2014), "$", "{b}\n"].join("");

    expect(generatedModule(input)).toBe('export const boardHtml =\n  "a\\u2014\\u0024{b}\\n";\n');
  });
});
