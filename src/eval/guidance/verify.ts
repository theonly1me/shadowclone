import { lstat, mkdir, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runProcess } from "../../io/process";
import { redactSecrets } from "../../redact";
import type { EvidenceFile } from "./checks";

type Verification = {
  readonly verdict: "pass" | "fail" | "not-verified";
  readonly evidence: string;
};

export async function verifyGuidanceCode(options: {
  readonly directory: string;
  readonly files: readonly EvidenceFile[];
}): Promise<Verification> {
  const directory = path.resolve(options.directory);
  const tests = options.files.filter((file) => /\.test\.[cm]?[jt]sx?$/.test(file.path)).map((file) => file.path);
  if (tests.length === 0) return { verdict: "not-verified", evidence: "No changed test file was produced." };
  for (const relativePath of tests) {
    const location = path.resolve(directory, relativePath);
    if (!location.startsWith(`${directory}${path.sep}`)) return { verdict: "fail", evidence: "A test path escaped the snapshot." };
  }
  if (process.platform !== "darwin") return { verdict: "not-verified", evidence: "Focused execution requires the macOS evaluation sandbox." };
  const bun = Bun.which("bun");
  if (!bun || !Bun.which("sandbox-exec")) return { verdict: "not-verified", evidence: "The focused test sandbox is unavailable." };
  const actualDirectory = await realpath(directory).catch(() => null);
  if (actualDirectory === null) return { verdict: "not-verified", evidence: "The focused test snapshot is unavailable." };
  for (const relativePath of tests) {
    const location = path.resolve(directory, relativePath);
    const metadata = await lstat(location).catch(() => null);
    if (!metadata?.isFile() || metadata.isSymbolicLink()) return { verdict: "fail", evidence: "A changed test is not a regular file." };
    const actualLocation = await realpath(location).catch(() => null);
    if (actualLocation === null || !actualLocation.startsWith(`${actualDirectory}${path.sep}`)) {
      return { verdict: "fail", evidence: "A changed test resolves outside the snapshot." };
    }
  }
  const runtime = path.join(directory, ".eval-verification");
  const existingRuntime = await lstat(runtime).catch(() => null);
  if (existingRuntime && (!existingRuntime.isDirectory() || existingRuntime.isSymbolicLink())) {
    return { verdict: "fail", evidence: "The focused test runtime is linked or not a directory." };
  }
  await mkdir(runtime, { recursive: true });
  const actualRuntime = await realpath(runtime).catch(() => null);
  if (actualRuntime !== path.join(actualDirectory, ".eval-verification")) {
    return { verdict: "fail", evidence: "The focused test runtime resolves outside the snapshot." };
  }
  const profile = [
    "(version 1)(allow default)(deny network*)(deny file-write*)",
    `(allow file-write* (subpath ${JSON.stringify(runtime)})(literal "/dev/null"))`,
    `(deny file-read* (subpath ${JSON.stringify(os.homedir())}))`,
    `(allow file-read* (literal ${JSON.stringify(bun)})(subpath ${JSON.stringify(directory)}))`,
  ].join("");
  try {
    const result = await runProcess({
      arguments: ["sandbox-exec", "-p", profile, bun, "test", ...tests],
      cwd: directory,
      environment: { PATH: "/usr/bin:/bin", HOME: runtime, TMPDIR: runtime, XDG_CACHE_HOME: runtime, BUN_INSTALL_CACHE_DIR: runtime, CI: "1" },
      timeoutMilliseconds: 90_000,
      maximumOutputBytes: 16384,
    });
    const output = redactSecrets({ text: `${result.stdout}\n${result.stderr}` }).slice(-1200);
    if (result.stderr.includes("sandbox-exec: sandbox_apply:")) return { verdict: "not-verified", evidence: "The focused test sandbox could not start." };
    return { verdict: result.exitCode === 0 ? "pass" : "fail", evidence: output || `Focused tests exited ${result.exitCode}.` };
  } catch {
    return { verdict: "not-verified", evidence: "Focused tests did not complete in the sandbox." };
  }
}
