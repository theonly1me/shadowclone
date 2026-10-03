import path from "node:path";
import { z } from "zod";
import { fingerprint } from "../../shared/structured";
import { readFrozenArtifact, writeFrozenArtifact } from "../workflow/preparation";
import { digestSchema, identitySchema } from "./schema";

const sourceSchema = z.strictObject({
  preparationFile: z.string(),
  preparationFingerprint: digestSchema,
  product: identitySchema,
  files: z.array(z.strictObject({ path: z.string(), fingerprint: digestSchema })),
  fingerprint: digestSchema,
});

export const preparationSourceFiles = [
  "src/eval/fixed/workflow/learner.ts",
  "src/eval/shared/accounting.ts",
  "src/eval/fixed/reusable/corpus.ts",
  "src/eval/fixed/reusable/corpusScope.ts",
  "src/eval/fixed/reusable/environments.ts",
  "src/eval/fixed/reusable/preparation.ts",
  "src/eval/fixed/reusable/learning.ts",
  "src/eval/fixed/reusable/learningLimits.ts",
  "src/eval/fixed/reusable/learningSource.ts",
  "src/eval/fixed/reusable/reuse.ts",
  "src/eval/fixed/reusable/guidance.ts",
  "package.json",
  "bun.lock",
];

export async function learningSourceFiles(repository: string) {
  const files: { path: string; fingerprint: string }[] = [];
  for await (const file of new Bun.Glob("src/**/*.ts").scan({ cwd: repository, onlyFiles: true })) {
    if (
      file.endsWith(".test.ts") ||
      file.startsWith("src/eval/") ||
      file === "src/cli/reusableEval.ts"
    )
      continue;
    files.push({
      path: file,
      fingerprint: Bun.CryptoHasher.hash(
        "sha256",
        await Bun.file(path.join(repository, file)).bytes(),
        "hex",
      ),
    });
  }
  for (const file of preparationSourceFiles) {
    files.push({
      path: file,
      fingerprint: Bun.CryptoHasher.hash(
        "sha256",
        await Bun.file(path.join(repository, file)).bytes(),
        "hex",
      ),
    });
  }
  return files.toSorted((left, right) => left.path.localeCompare(right.path));
}

export async function writeLearningSource(options: {
  preparationFile: string;
  preparationFingerprint: string;
  product: z.infer<typeof identitySchema>;
  repository: string;
}) {
  const files = await learningSourceFiles(options.repository);
  const sourceFile = path.join(path.dirname(options.preparationFile), "learning-source.json");
  await writeFrozenArtifact({
    file: sourceFile,
    value: sourceSchema.parse({
      preparationFile: path.resolve(options.preparationFile),
      preparationFingerprint: options.preparationFingerprint,
      product: options.product,
      files,
      fingerprint: fingerprint(files),
    }),
  });
  return sourceFile;
}

export async function requireUnchangedLearningSource(options: {
  sourceFile: string;
  repository: string;
}) {
  const source = sourceSchema.parse(await readFrozenArtifact(options.sourceFile));
  const current = await learningSourceFiles(options.repository);
  if (
    fingerprint(source.files) !== source.fingerprint ||
    fingerprint(current) !== source.fingerprint
  )
    throw new Error(
      "Learning implementation, fixture setup, corpus, or runtime changed; cached preparations cannot be reused.",
    );
  return source;
}
