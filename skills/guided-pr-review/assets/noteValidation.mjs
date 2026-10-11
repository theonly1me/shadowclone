function validNote(note) {
  if (!note || typeof note !== "object") return false;
  const fields = ["id", "pr", "anchor", "body", "originalBody", "quote"];
  if (fields.some((key) => typeof note[key] !== "string")) return false;
  if (!report.pulls.some((pull) => pull.id === note.pr)) return false;
  if (!["human", "agent"].includes(note.author)) return false;
  if (typeof note.selected !== "boolean" || typeof note.dismissed !== "boolean") return false;
  if (
    !Array.isArray(note.evidence) ||
    note.evidence.some((id) => !report.evidence.some((item) => item.id === id))
  )
    return false;
  if (
    note.author === "agent" &&
    ["reason", "verification", "counterevidence"].some((key) => typeof note[key] !== "string")
  )
    return false;
  if (note.source !== null) {
    const source = note.source;
    if (!source || typeof source.path !== "string" || !["BASE", "HEAD"].includes(source.side))
      return false;
    if (
      !Number.isInteger(source.start) ||
      !Number.isInteger(source.end) ||
      source.start < 1 ||
      source.end < source.start
    )
      return false;
  }
  return true;
}
