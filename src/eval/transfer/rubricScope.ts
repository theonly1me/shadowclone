export const codeRubricVersion = 2;

export function criterionInterpretation(identifier: string): string | null {
  if (identifier !== "identifier-case") return null;
  return "Use camelCase for freely chosen value identifiers and kebab-case for symbolic string identifiers, such as enum or discriminator values. PascalCase type, interface, class, and component names are valid. Human-readable error messages, UI copy, and test descriptions are valid prose, not symbolic identifiers. Do not penalize those names or messages under this criterion. Preserve task-required protocol values. This scope was explicitly clarified by the user.";
}
