import { rm } from "node:fs/promises";
import path from "node:path";
import { buildRuntimeArtifacts } from "./bundle";

const entryPoint = "packages/cli/src/main.ts";
const outputFile = "dist/shadowclone.js";

if (!(await Bun.file(entryPoint).exists())) {
  throw new Error(`${entryPoint} does not exist, so there is nothing to build`);
}

const artifacts = await buildRuntimeArtifacts(entryPoint);

await rm("dist", { recursive: true, force: true });

for (const [index, artifact] of artifacts.entries()) {
  const relativePath = path.relative(process.cwd(), artifact.path);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Build output escapes its destination");
  }

  const destination =
    index === 0 ? outputFile : path.join("dist", relativePath);

  await Bun.write(destination, artifact);
}

console.log(
  `${outputFile} ${(Bun.file(outputFile).size / 1000).toFixed(0)} KB`,
);
