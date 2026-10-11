import { existsSync, lstatSync, readlinkSync, realpathSync } from "node:fs";
import path from "node:path";

function packageRoot(file: string): string | null {
  const marker = `${path.sep}node_modules${path.sep}`;
  const position = file.lastIndexOf(marker);

  if (position < 0) {
    return null;
  }

  const [first, second] = file.slice(position + marker.length).split(path.sep);

  if (first === undefined || (first.startsWith("@") && second === undefined)) {
    return null;
  }

  return path.join(
    file.slice(0, position + marker.length),
    first,
    ...(first.startsWith("@") && second !== undefined ? [second] : []),
  );
}

function executableLinks(file: string): readonly string[] {
  const links = new Set<string>();
  let current = file;

  while (!links.has(current)) {
    current = path.join(realpathSync(path.dirname(current)), path.basename(current));
    links.add(current);

    if (!lstatSync(current).isSymbolicLink()) {
      return [...links];
    }

    current = path.resolve(path.dirname(current), readlinkSync(current));
  }

  throw new Error("A tool runtime contains a cyclic executable link");
}

export function executableReadPaths(options: {
  readonly file: string;
  readonly tool: string;
}): readonly string[] {
  const resolved = realpathSync(options.file);
  const packageDirectory = packageRoot(resolved);
  const runtime = path.dirname(path.dirname(resolved));
  const installedRuntime =
    path.basename(path.dirname(resolved)) === "bin" &&
    ["VERSION", "release", "pyvenv.cfg"].some((name) => existsSync(path.join(runtime, name)));
  const javaRuntime =
    path.basename(path.dirname(resolved)) === "bin" &&
    (options.tool === "mvn" || options.tool === "gradle");

  return [
    options.file,
    ...executableLinks(options.file),
    ...(packageDirectory ? [packageDirectory] : []),
    ...(installedRuntime ? [runtime] : []),
    ...(javaRuntime
      ? ["bin", "boot", "lib", "conf/logging"]
          .map((directory) => path.join(runtime, directory))
          .filter(existsSync)
      : []),
  ];
}
