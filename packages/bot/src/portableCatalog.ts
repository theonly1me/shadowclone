import path from "node:path";

export const portableCatalogName = "shadowclone-guidance";
export const portableCatalogPath = `plugins/shadowclone-personal/skills/${portableCatalogName}/SKILL.md`;

export async function portableCatalog(options: {
  readonly directory: string;
  readonly skills: ReadonlyMap<string, string>;
}): Promise<string> {
  if (options.skills.has(portableCatalogName))
    throw new Error("A selected skill occupies the generated guidance catalog name.");
  let text = await Bun.file(path.join(options.directory, ".shadowclone-skills/catalog.md")).text();
  for (const [name, filePath] of options.skills) {
    text = text.replaceAll(`Read: \`${filePath}\`.`, `Use the \`${name}\` skill.`);
  }
  return `---\nname: ${portableCatalogName}\ndescription: Read before task work to select the reviewed guidance for this task.\n---\n\n${text}`;
}
