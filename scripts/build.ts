import { rm } from "node:fs/promises";

const entryPoint = "src/cli/index.ts";
const outputFile = "dist/shadowclone.js";

if (!(await Bun.file(entryPoint).exists())) {
  throw new Error(`${entryPoint} does not exist, so there is nothing to build`);
}

await rm("dist", { recursive: true, force: true });
await Bun.$`bun build --minify --target=bun ${entryPoint} --outfile ${outputFile}`.quiet();

console.log(`${outputFile} ${(Bun.file(outputFile).size / 1000).toFixed(0)} KB`);
