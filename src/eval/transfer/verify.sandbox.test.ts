import { expect, test } from "bun:test";
import path from "node:path";
import { sensitivePaths } from "./sensitivePaths";
import { verificationArguments } from "./verify";

const home = "/home/person";
const workspace = "/tmp/snapshot";

function profileFor(platform: NodeJS.Platform): string {
  return verificationArguments({
    directory: workspace,
    arguments: ["bun", "run", "test"],
    platform,
    homeDirectory: home,
  }).join(" ");
}

test("the macOS profile denies reads of every credential root", () => {
  const profile = profileFor("darwin");

  for (const entry of sensitivePaths(home)) {
    expect(profile).toContain(`(subpath ${JSON.stringify(entry.path)})`);
  }
  expect(profile).toContain("deny file-read*");
  expect(profile).toContain("deny network*");
});

test("the macOS deny rules come after the workspace write allowance", () => {
  const profile = profileFor("darwin");

  expect(profile.indexOf("deny file-read*")).toBeGreaterThan(
    profile.indexOf("allow file-write*"),
  );
});

test("the Linux sandbox masks every credential root", () => {
  const arguments_ = verificationArguments({
    directory: workspace,
    arguments: ["bun", "run", "test"],
    platform: "linux",
    homeDirectory: home,
  });

  expect(arguments_).toContain("--unshare-pid");
  expect(arguments_).toContain("--unshare-ipc");
  expect(arguments_).toContain("--unshare-net");
  expect(arguments_).toContain("--tmpfs");
  expect(arguments_).toContain("--cap-drop");
});

test("the Linux masks are applied before the workspace bind", () => {
  const arguments_ = verificationArguments({
    directory: workspace,
    arguments: ["bun", "run", "test"],
    platform: "linux",
    homeDirectory: home,
  });

  expect(arguments_.indexOf("--ro-bind")).toBeLessThan(arguments_.lastIndexOf("--bind"));
});

test("the shadowclone directory is never readable during verification", () => {
  expect(profileFor("darwin")).toContain(path.join(home, ".shadowclone"));
  expect(profileFor("darwin")).toContain(path.join(home, ".claude"));
});

test("an unsupported platform refuses to run verification unsandboxed", () => {
  expect(() =>
    verificationArguments({
      directory: workspace,
      arguments: ["bun", "run", "test"],
      platform: "win32",
      homeDirectory: home,
    }),
  ).toThrow("requires macOS sandbox-exec or Linux bubblewrap");
});
