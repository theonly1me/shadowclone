const proxyVariables = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "http_proxy",
  "https_proxy",
  "ALL_PROXY",
  "all_proxy",
  "GRPC_PROXY",
  "grpc_proxy",
  "JAVA_TOOL_OPTIONS",
];

function shellQuoted(argument: string): string {
  return `'${argument.replaceAll("'", `'\\''`)}'`;
}

export function sandboxCommand(options: {
  readonly arguments: readonly string[];
  readonly temporary: string;
}): string {
  const environment = [
    `export TMPDIR=${shellQuoted(options.temporary)}`,
    ...proxyVariables.map((name) => `export ${name}="\${${name}//localhost/127.0.0.1}"`),
  ];
  return `${environment.join("; ")}; exec ${options.arguments.map(shellQuoted).join(" ")}`;
}
