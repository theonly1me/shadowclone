import { mkdir, rm } from "node:fs/promises";

const entryPoint = "src/cli/index.ts";
const binaryName = "shadowclone";
const outputDirectory = "dist";
const checksumFile = `${outputDirectory}/SHA256SUMS.txt`;
const platforms = [
  "darwin-arm64",
  "darwin-x64",
  "linux-x64",
  "linux-arm64",
] as const;

async function compile(options: {
  platform: string;
  outputFile: string;
}): Promise<void> {
  await Bun.$`bun build --compile --minify --sourcemap --target=bun-${options.platform} ${entryPoint} --outfile ${options.outputFile}`.quiet();
}

async function archive(options: {
  platform: string;
  archiveFile: string;
}): Promise<void> {
  await Bun.$`tar -czf ${options.archiveFile} -C ${outputDirectory}/${options.platform} ${binaryName}`.quiet();
}

async function checksumOf(file: string): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(await Bun.file(file).bytes());
  return hasher.digest("hex");
}

function megabytesOf(byteCount: number): string {
  return `${(byteCount / 1_000_000).toFixed(1)} MB`;
}

if (!(await Bun.file(entryPoint).exists())) {
  throw new Error(`${entryPoint} does not exist, so there is nothing to build`);
}

await rm(outputDirectory, { recursive: true, force: true });

const checksumLines: string[] = [];

for (const platform of platforms) {
  await mkdir(`${outputDirectory}/${platform}`, { recursive: true });
  const outputFile = `${outputDirectory}/${platform}/${binaryName}`;
  await compile({ platform, outputFile });

  const archiveName = `${binaryName}-${platform}.tar.gz`;
  const archiveFile = `${outputDirectory}/${archiveName}`;
  await archive({ platform, archiveFile });

  const checksum = await checksumOf(archiveFile);
  checksumLines.push(`${checksum}  ${archiveName}`);
  console.log(
    `${archiveName} ${megabytesOf(Bun.file(archiveFile).size)} from ${megabytesOf(Bun.file(outputFile).size)} ${checksum}`,
  );
}

await Bun.write(checksumFile, `${checksumLines.join("\n")}\n`);
console.log(`wrote ${checksumFile}`);
