import type { SeedLibrary } from "../skills";

export function wizardAnswers(options: {
  readonly library: SeedLibrary;
  readonly skill: string;
}): readonly string[] {
  const number = options.library.independentSkills.findIndex((entry) => entry.id === options.skill);

  if (number < 0) {
    throw new Error(`${options.skill} is not an optional bundled skill`);
  }

  return [...options.library.axes.map(() => "1"), String(number + 1)];
}
