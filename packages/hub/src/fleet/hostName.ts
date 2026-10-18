import os from "node:os";

export function hubHostName(hostname: string = os.hostname()): string {
  const name = (hostname.split(".")[0] ?? "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/g, "-")
    .replace(/^-+/, "")
    .slice(0, 32);

  return name === "" ? "hub" : name;
}
