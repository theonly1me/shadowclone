import { spawnSync } from "node:child_process";

export function gitRead(options) {
  const result = spawnSync(
    "git",
    ["--no-pager", "--no-replace-objects", "--literal-pathspecs", ...options.arguments],
    {
      cwd: options.checkout,
      maxBuffer: 64 * 1024 * 1024,
      encoding: options.binary ? undefined : "utf8",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    },
  );
  if (result.error) throw new Error("Cannot inspect Git objects: " + result.error.message);
  if (result.status !== 0)
    throw new Error("Git inspection failed: " + String(result.stderr).trim());
  return result.stdout;
}

export function isAncestor(options) {
  const result = spawnSync(
    "git",
    ["--no-replace-objects", "merge-base", "--is-ancestor", options.from, options.to],
    {
      cwd: options.checkout,
      encoding: "utf8",
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    },
  );
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new Error(
    "Cannot establish PR ancestry: " + (result.error?.message ?? result.stderr.trim()),
  );
}

export function blobText(options) {
  const content = gitRead({
    checkout: options.checkout,
    arguments: ["show", options.sha + ":" + options.path],
    binary: true,
  });
  return content.includes(0) ? null : content.toString("utf8");
}
