import path from "node:path";

export async function detectVerificationTools(options: {
  readonly cwd?: string;
  readonly overrides?: readonly string[];
}): Promise<readonly string[]> {
  if (options.overrides && options.overrides.length > 0) {
    return options.overrides.map((cmd) => `Bash(${cmd}:*)`);
  }
  if (!options.cwd) {
    return [
      "Bash(bun test:*)",
      "Bash(bun run typecheck:*)",
      "Bash(npm test:*)",
    ];
  }
  const tools: string[] = [];
  const bunLock = Bun.file(path.join(options.cwd, "bun.lock"));
  const bunLockb = Bun.file(path.join(options.cwd, "bun.lockb"));
  const packageJson = Bun.file(path.join(options.cwd, "package.json"));
  const cargoToml = Bun.file(path.join(options.cwd, "Cargo.toml"));
  const goMod = Bun.file(path.join(options.cwd, "go.mod"));
  const pyprojectToml = Bun.file(path.join(options.cwd, "pyproject.toml"));
  const makefile = Bun.file(path.join(options.cwd, "Makefile"));

  if ((await bunLock.exists()) || (await bunLockb.exists())) {
    tools.push("Bash(bun test:*)", "Bash(bun run typecheck:*)");
  } else if (await packageJson.exists()) {
    tools.push("Bash(npm test:*)", "Bash(npm run typecheck:*)");
  }
  if (await cargoToml.exists()) {
    tools.push("Bash(cargo test:*)", "Bash(cargo check:*)");
  }
  if (await goMod.exists()) {
    tools.push("Bash(go test:*)");
  }
  if (await pyprojectToml.exists()) {
    tools.push("Bash(pytest:*)", "Bash(python -m unittest:*)");
  }
  if (await makefile.exists()) {
    tools.push("Bash(make test:*)", "Bash(make check:*)");
  }
  if (tools.length === 0) {
    tools.push(
      "Bash(bun test:*)",
      "Bash(bun run typecheck:*)",
      "Bash(npm test:*)",
    );
  }
  return tools;
}
