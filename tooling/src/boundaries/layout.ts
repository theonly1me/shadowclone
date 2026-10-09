import path from "node:path";
import { packageLayout, packageNames, type PackageLayout, type PackageName } from "./packages";
import type { WorkspaceKey } from "./manifests";

const packagesRoot = "packages";

function ownersOf(layout: PackageLayout): ReadonlyMap<string, PackageName> {
  const owners = new Map<string, PackageName>();

  for (const name of packageNames) {
    for (const moduleName of layout.rootModules[name] ?? []) {
      owners.set(moduleName, name);
    }
  }

  return owners;
}

function stemOf(segment: string | undefined): string {
  const [stem] = (segment ?? "").split(".");

  return stem ?? "";
}

export function packageFolderOf(file: string): PackageName | null {
  const [root, name, ...rest] = file.split("/");
  const known = packageNames.find((packageName) => packageName === name);

  return root === packagesRoot && known && rest.length > 0 ? known : null;
}

export function packageOfFile(options: {
  file: string;
  layout?: PackageLayout;
}): PackageName | null {
  const layout = options.layout ?? packageLayout;
  const folder = packageFolderOf(options.file);

  if (folder) {
    return folder;
  }

  const relative = path.posix.relative(layout.sourceRoot, options.file);

  if (relative.startsWith("..")) {
    return null;
  }

  const [segment] = relative.split("/");

  return ownersOf(layout).get(stemOf(segment)) ?? null;
}

export function workspaceKeyOfFile(file: string): WorkspaceKey {
  const folder = packageFolderOf(file);

  if (folder) {
    return folder;
  }

  const [first] = file.split("/");

  return first === "evals" || first === "tooling" ? first : "root";
}
