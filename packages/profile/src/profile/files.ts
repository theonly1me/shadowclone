const profileRoots = new Set(["global", "org"]);

export function isProfileRelativePath(value: string): boolean {
  const segments = value.split("/");

  return (
    !value.includes("\\") &&
    profileRoots.has(segments[0] ?? "") &&
    segments.length > 1 &&
    segments.every(
      (segment) => segment.length > 0 && segment !== "." && segment !== "..",
    )
  );
}
