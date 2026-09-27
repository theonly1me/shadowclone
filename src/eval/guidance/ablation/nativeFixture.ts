import path from "node:path";

export async function prepareNativeFixture(options: {
  readonly directory: string;
  readonly packet: string;
  readonly forbidden: string;
  readonly mode: "hook" | "memory" | "prompt";
  readonly scripted?: boolean;
}) {
  const { directory, packet, forbidden } = options;

  const configuration = path.join(directory, "configuration");
  const memory = path.join(directory, "memory");
  const hook = path.join(directory, "hook.json");

  await Bun.write(path.join(configuration, "CLAUDE.md"), forbidden);
  await Bun.write(path.join(memory, "MEMORY.md"), packet);
  await Bun.write(
    path.join(directory, "references/fixture.md"),
    "Synthetic reference content for successful retrieval.\n",
  );
  await Bun.write(
    hook,
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: packet,
      },
    }),
  );

  const protectedPaths = [
    "memory/MEMORY.md",
    "references/fixture.md",
    "hook.json",
    "configuration/CLAUDE.md",
  ];

  const fingerprints = async () =>
    Promise.all(
      protectedPaths.map(async (relativePath) => ({
        relativePath,
        fingerprint: new Bun.CryptoHasher("sha256")
          .update(
            await Bun.file(path.join(directory, relativePath)).arrayBuffer(),
          )
          .digest("hex"),
      })),
    );

  const before = await fingerprints();

  const settings = {
    autoMemoryEnabled: options.mode === "memory",
    autoMemoryDirectory: memory,
    disableAllHooks: options.mode !== "hook",
    permissions: {
      allow: options.scripted
        ? ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]
        : [],
    },
    hooks:
      options.mode === "hook"
        ? {
            SessionStart: [
              {
                hooks: [
                  {
                    type: "command",
                    command: `/bin/cat ${JSON.stringify(hook)}`,
                    timeout: 10,
                  },
                ],
              },
            ],
          }
        : {},
  };

  return { configuration, memory, hook, fingerprints, before, settings };
}
