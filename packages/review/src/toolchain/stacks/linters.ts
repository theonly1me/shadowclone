import type { ParserId, Stack, StackContext } from "../types";

function changed(options: { readonly context: StackContext; readonly pattern: RegExp }): readonly string[] {
  return options.context.changedFiles.filter((file) => options.pattern.test(file) && options.context.exists(file));
}

function linter(options: {
  readonly id: string;
  readonly tool: string;
  readonly sources: RegExp;
  readonly parser: ParserId;
  readonly command: (files: readonly string[]) => readonly string[];
}): Stack {
  return {
    id: options.id,
    sources: options.sources,
    detect: () => true,
    install: () => null,
    commands: [
      {
        tool: options.tool,
        scope: "changed-lines",
        parser: options.parser,
        command: (context) => {
          const files = changed({ context, pattern: options.sources });

          return files.length > 0 ? options.command(files) : null;
        },
      },
    ],
  };
}

const workflowFiles = /^\.github\/workflows\/[^/]+\.ya?ml$/;

const infrastructureFiles = /\.(?:tf|tfvars)$|(?:^|\/)(?:Dockerfile|Containerfile)(?:\.[\w.-]+)?$|\.dockerfile$|^(?!\.github\/)(?:.*\/)?(?!pnpm-|\.)[^/]+\.ya?ml$/;

const infrastructureStack: Stack = {
  id: "infrastructure",
  sources: infrastructureFiles,
  detect: () => true,
  install: () => null,
  commands: [
    {
      tool: "trivy",
      scope: "new-in-head",
      parser: "trivy-json",
      command: () => [
        "trivy",
        "config",
        "--quiet",
        "--format",
        "json",
        "--severity",
        "MEDIUM,HIGH,CRITICAL",
        "--skip-check-update",
        "--skip-version-check",
        "--disable-telemetry",
        "--skip-dirs",
        "**/node_modules",
        ".",
      ],
    },
  ],
};

export const lintStacks: readonly Stack[] = [
  linter({ id: "shell", tool: "shellcheck", sources: /\.(?:sh|bash)$/, parser: "colon", command: (files) => ["shellcheck", "--format", "gcc", ...files] }),
  linter({
    id: "docker",
    tool: "hadolint",
    sources: /(?:^|\/)(?:Dockerfile|Containerfile)(?:\.[\w.-]+)?$|\.dockerfile$/,
    parser: "hadolint",
    command: (files) => ["hadolint", "--no-color", "--format", "gnu", ...files],
  }),
  linter({ id: "workflows", tool: "actionlint", sources: workflowFiles, parser: "colon", command: (files) => ["actionlint", "-no-color", "-oneline", ...files] }),
  linter({
    id: "actions-security",
    tool: "zizmor",
    sources: /^\.github\/workflows\/[^/]+\.ya?ml$|(?:^|\/)action\.ya?ml$/,
    parser: "github",
    command: (files) => ["zizmor", "--offline", "--format", "github", ...files],
  }),
  linter({ id: "sql", tool: "squawk", sources: /\.sql$/, parser: "colon", command: (files) => ["squawk", "--reporter", "gcc", ...files] }),
  infrastructureStack,
];
