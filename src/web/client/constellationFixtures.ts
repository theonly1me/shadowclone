import type { BuildItem } from "../../builds/types";

export function constellationItems(options: { readonly count: number; readonly singleCategory?: boolean }): readonly BuildItem[] {
  return Array.from({ length: options.count }, (_, index) => ({
    id: `skill-${index}`, name: `skill-${index}`, title: `Skill ${index}`,
    description: `Synthetic behavior ${index}`, text: `Synthetic instructions ${index}`,
    kind: "skill", category: options.singleCategory ? "engineering" : `topic-${index % Math.min(10, options.count)}`,
    section: "workflow", axis: null, owner: "packaged",
  }));
}
