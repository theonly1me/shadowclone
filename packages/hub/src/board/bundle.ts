import path from "node:path";

const viewFolder = path.join(import.meta.dir, "view");

const styleFiles = ["theme.css", "layout.css"];

const generatedFile = path.join(import.meta.dir, "html.ts");

const charactersToEscape = /[^\x20-\x7e]|\$/g;

export async function boardDocument(): Promise<string> {
  const result = await Bun.build({
    entrypoints: [path.join(viewFolder, "main.ts")],
    target: "browser",
    format: "esm",
    minify: true,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
  });
  const [output] = result.outputs;

  if (!result.success || output === undefined) {
    throw new Error("The board view failed to build.");
  }

  const script = (await output.text()).replaceAll("</script", "<\\/script");
  const styles = await Promise.all(
    styleFiles.map((file) => Bun.file(path.join(viewFolder, file)).text()),
  );

  if (script.includes("<!--")) {
    throw new Error("The board script holds an HTML comment opener.");
  }

  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Sessions</title>",
    `<style>${styles.join("\n")}</style>`,
    "</head>",
    "<body>",
    '<main id="board"></main>',
    `<script type="module">${script}</script>`,
    "</body>",
    "</html>",
  ].join("\n");
}

export function generatedModule(document: string): string {
  const literal = JSON.stringify(document).replace(
    charactersToEscape,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );

  return `export const boardHtml =\n  ${literal};\n`;
}

if (import.meta.main) {
  const expected = generatedModule(await boardDocument());

  if (process.argv.includes("--write")) {
    await Bun.write(generatedFile, expected);
    console.log("board: wrote packages/hub/src/board/html.ts");
  } else if ((await Bun.file(generatedFile).text()) === expected) {
    console.log("board: the generated view matches its source");
  } else {
    console.error("board: packages/hub/src/board/html.ts is stale. Run bun run board.");
    process.exit(1);
  }
}
