export function requireObject(options) {
  if (options.value === null || typeof options.value !== "object" || Array.isArray(options.value))
    throw new Error(options.label + " must be an object.");
  return options.value;
}

export function requireArray(options) {
  if (!Array.isArray(options.value)) throw new Error(options.label + " must be an array.");
  return options.value;
}

export function requireText(options) {
  if (typeof options.value !== "string" || (!options.allowEmpty && !options.value.trim()))
    throw new Error(options.label + " must be text.");
  return options.value;
}

export function requireId(options) {
  const value = requireText(options);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value))
    throw new Error(options.label + " must be a lowercase id.");
  return value;
}

export function requirePath(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.includes("\0") ||
    value.startsWith("/") ||
    value.split("/").some((part) => part === ".." || part === ".")
  )
    throw new Error("Source paths must stay inside the repository.");
  return value;
}

export function requireSha(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{40,64}$/.test(value))
    throw new Error("Pin a full commit SHA.");
  return value;
}

export function uniqueIds(options) {
  const ids = new Set();
  for (const item of options.items) {
    requireObject({ value: item, label: options.label });
    const id = requireId({ value: item.id, label: options.label + ".id" });
    if (ids.has(id)) throw new Error("Duplicate " + options.label + " id: " + id);
    ids.add(id);
  }
  return ids;
}

export function checkReferences(options) {
  for (const id of requireArray({ value: options.values, label: options.label })) {
    if (!options.ids.has(id))
      throw new Error(options.label + " refers to unknown evidence or PR: " + id);
  }
}
