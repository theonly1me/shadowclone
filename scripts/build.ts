import { copyFile, mkdir, rm } from "node:fs/promises";

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

const scope = "@shadowclone";
const packageBaseName = "cli";
const npmDirectory = `${outputDirectory}/npm`;
const manifest: unknown = await Bun.file("package.json").json();
const version =
  typeof manifest === "object" &&
  manifest !== null &&
  "version" in manifest &&
  typeof manifest.version === "string"
    ? manifest.version
    : "0.0.0";

const sharedManifestFields = {
  version,
  license: "MIT",
  repository: {
    type: "git",
    url: "git+https://github.com/theonly1me/shadowclone.git",
  },
  homepage: "https://shadowclone.co",
} as const;

async function writePlatformPackage(options: {
  platform: string;
  binaryFile: string;
}): Promise<void> {
  const [operatingSystem, architecture] = options.platform.split("-");
  const directory = `${npmDirectory}/${options.platform}`;
  await mkdir(`${directory}/bin`, { recursive: true });
  await copyFile(options.binaryFile, `${directory}/bin/${binaryName}`);
  await Bun.write(
    `${directory}/package.json`,
    `${JSON.stringify(
      {
        name: `${scope}/${packageBaseName}-${options.platform}`,
        description: `The ${options.platform} binary for shadowclone.`,
        ...sharedManifestFields,
        os: [operatingSystem],
        cpu: [architecture],
        files: ["bin"],
      },
      null,
      2,
    )}\n`,
  );
}

async function writeLauncherPackage(): Promise<void> {
  const directory = `${npmDirectory}/launcher`;
  await mkdir(`${directory}/dist`, { recursive: true });
  await mkdir(`${directory}/bin`, { recursive: true });
  await copyFile(
    "npm/launcher/bin/shadowclone.mjs",
    `${directory}/bin/shadowclone.mjs`,
  );
  await Bun.$`bun build --minify --target=bun ${entryPoint} --outfile ${directory}/dist/shadowclone.js`.quiet();
  await copyFile("README.md", `${directory}/README.md`);
  await copyFile("LICENSE", `${directory}/LICENSE`);
  await Bun.write(
    `${directory}/package.json`,
    `${JSON.stringify(
      {
        name: `${scope}/${packageBaseName}`,
        description:
          "Learns how you work from the AI coding sessions already on your disk, then runs copies of you inside the agent you already use.",
        ...sharedManifestFields,
        bin: { [binaryName]: "bin/shadowclone.mjs" },
        files: ["bin", "dist", "README.md", "LICENSE"],
        optionalDependencies: Object.fromEntries(
          platforms.map((platform) => [
            `${scope}/${packageBaseName}-${platform}`,
            version,
          ]),
        ),
      },
      null,
      2,
    )}\n`,
  );
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

  await writePlatformPackage({ platform, binaryFile: outputFile });

  const checksum = await checksumOf(archiveFile);
  checksumLines.push(`${checksum}  ${archiveName}`);
  console.log(
    `${archiveName} ${megabytesOf(Bun.file(archiveFile).size)} from ${megabytesOf(Bun.file(outputFile).size)} ${checksum}`,
  );
}

await writeLauncherPackage();
console.log(`wrote ${npmDirectory} packages at ${version}`);

await Bun.write(checksumFile, `${checksumLines.join("\n")}\n`);
console.log(`wrote ${checksumFile}`);
