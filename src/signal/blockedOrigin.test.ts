import { expect, test } from "bun:test";
import { isOriginBlocked } from "./blockedOrigin";
import { normalizeRemoteOrigin } from "./origin";

const acme = normalizeRemoteOrigin("git@github.com:acme/repo.git");

function blocked(options: {
  readonly patterns: readonly string[];
  readonly cwd?: string;
}): boolean {
  if (!acme) {
    throw new Error("Expected a normalized origin");
  }

  return isOriginBlocked({
    origin: acme,
    cwd: options.cwd ?? "",
    patterns: options.patterns,
  });
}

test("matches a wildcard across the host and owner separator", () => {
  expect(blocked({ patterns: ["*acme*"] })).toBeTrue();
  expect(blocked({ patterns: ["*"] })).toBeTrue();
  expect(blocked({ patterns: ["github.com/*"] })).toBeTrue();
  expect(blocked({ patterns: ["*security*"] })).toBeFalse();
});

test("matches a repository pattern only when the working directory is known", () => {
  expect(
    blocked({ patterns: ["github.com/acme/secret-*"], cwd: "/work/secret-api" }),
  ).toBeTrue();
  expect(blocked({ patterns: ["github.com/acme/secret-*"] })).toBeFalse();
  expect(
    blocked({ patterns: ["*/secret-api"], cwd: "/work/secret-api" }),
  ).toBeTrue();
});

test("treats every character other than an asterisk as a literal", () => {
  expect(blocked({ patterns: ["!github.com/acme"] })).toBeFalse();
  expect(blocked({ patterns: ["github.com/acm?"] })).toBeFalse();
  expect(blocked({ patterns: ["github.com/{acme,other}"] })).toBeFalse();
  expect(blocked({ patterns: ["githubXcom/acme"] })).toBeFalse();
});

test("blocks nothing when the managed policy lists no patterns", () => {
  expect(blocked({ patterns: [], cwd: "/work/repo" })).toBeFalse();
});
