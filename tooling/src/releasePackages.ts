import { z } from "zod";
import product from "@shadowclone/core/product.json";

export async function pendingReleasePackages(options: {
  readonly cliName: string;
  readonly skillsName: string;
  readonly version: string;
  readonly status?: (url: string) => Promise<number>;
}) {
  const status = options.status ?? (async (url: string) => (await fetch(url)).status);
  const names = [options.cliName, options.skillsName];
  const responses = await Promise.all(
    names.map((name) =>
      status(
        "https://registry.npmjs.org/" +
          encodeURIComponent(name) +
          "/" +
          encodeURIComponent(options.version),
      ),
    ),
  );
  for (const [index, response] of responses.entries())
    if (response !== 200 && response !== 404)
      throw new Error(
        "npm registry answered " + response + " for " + names[index] + "@" + options.version,
      );
  const [cli, skills] = responses;
  return {
    tag: cli === 404 || skills === 404 ? "v" + options.version : null,
    cliMissing: cli === 404,
    skillsMissing: skills === 404,
  };
}

if (import.meta.main) {
  const manifest = z
    .object({ name: z.literal("@shadowclone/skills") })
    .parse(await Bun.file("packages/skills/package.json").json());
  const pending = await pendingReleasePackages({
    cliName: product.name,
    skillsName: manifest.name,
    version: product.version,
  });
  console.log("cli_missing=" + pending.cliMissing);
  console.log("skills_missing=" + pending.skillsMissing);
  if (pending.tag) console.log("tag=" + pending.tag);
}
