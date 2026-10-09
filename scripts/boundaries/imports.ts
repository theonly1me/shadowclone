import path from "node:path";
import ts from "typescript";

export type ImportEdge = {
  readonly file: string;
  readonly line: number;
  readonly specifier: string;
};

function lineOfPosition(options: { text: string; position: number }): number {
  return options.text.slice(0, options.position).split("\n").length;
}

export function readImports(options: { file: string; text: string }): readonly ImportEdge[] {
  const information = ts.preProcessFile(options.text, true, true);

  return information.importedFiles.map((imported) => ({
    file: options.file,
    line: lineOfPosition({ text: options.text, position: imported.pos }),
    specifier: imported.fileName,
  }));
}

export function resolveRelativeImport(options: { file: string; specifier: string }): string | null {
  if (!options.specifier.startsWith(".")) {
    return null;
  }

  return path.posix.normalize(path.posix.join(path.posix.dirname(options.file), options.specifier));
}
