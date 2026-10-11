import {
  requireObject,
  requireArray,
  requireText,
  requirePath,
  requireSha,
  uniqueIds,
  checkReferences,
} from "./contract.mjs";

export function validateReport(report) {
  requireObject({ value: report, label: "report" });
  if (report.version !== 1) throw new Error("Report version must be 1.");
  requireText({ value: report.title, label: "title" });
  requireText({ value: report.summary, label: "summary" });
  requireText({ value: report.generatedAt, label: "generatedAt" });
  const pulls = requireArray({ value: report.pulls, label: "pulls" });
  if (!pulls.length) throw new Error("Include at least one PR.");
  const prIds = uniqueIds({ items: pulls, label: "PR" });
  for (const pull of pulls) {
    if (
      !/^[\w.-]+\/[\w.-]+$/.test(pull.repository) ||
      !Number.isInteger(pull.number) ||
      pull.number < 1
    )
      throw new Error("Each PR needs a repository and positive number.");
    requireText({ value: pull.title, label: "PR title" });
    if (pull.url !== "https://github.com/" + pull.repository + "/pull/" + pull.number)
      throw new Error("PR URLs must match their repository and number.");
    requireSha(pull.baseSha);
    requireSha(pull.headSha);
    if (pull.files !== undefined)
      for (const file of requireArray({ value: pull.files, label: "files" })) {
        requirePath(file.path);
        requirePath(file.oldPath);
        requireText({ value: file.diff, label: "diff", allowEmpty: true });
      }
  }
  const evidence = requireArray({ value: report.evidence, label: "evidence" });
  const evidenceIds = uniqueIds({ items: evidence, label: "evidence" });
  for (const item of evidence) {
    if (!prIds.has(item.pr)) throw new Error("Evidence refers to an unknown PR.");
    requirePath(item.path);
    if (
      !["BASE", "HEAD"].includes(item.side) ||
      !Number.isInteger(item.start) ||
      !Number.isInteger(item.end) ||
      item.start < 1 ||
      item.end < item.start
    )
      throw new Error("Evidence needs an ordered source range and BASE or HEAD side.");
    requireText({ value: item.quote, label: "evidence quote" });
    if (item.text !== undefined && item.text !== item.quote)
      throw new Error("Collected evidence does not match its quote.");
  }
  const groups = requireArray({ value: report.groups, label: "groups" });
  const groupIds = uniqueIds({ items: groups, label: "group" });
  for (const group of groups) {
    for (const key of ["title", "summary", "why", "before", "after"])
      requireText({ value: group[key], label: "group " + key });
    checkReferences({ values: group.prs, ids: prIds, label: "group.prs" });
    checkReferences({ values: group.evidence, ids: evidenceIds, label: "group.evidence" });
    for (const file of requireArray({ value: group.files, label: "group.files" })) {
      if (!prIds.has(file.pr)) throw new Error("A group file refers to an unknown PR.");
      requirePath(file.path);
      const pull = pulls.find((entry) => entry.id === file.pr);
      if (pull.files && !pull.files.some((entry) => entry.path === file.path))
        throw new Error("A group references a file outside the PR diff: " + file.path);
    }
    for (const step of requireArray({ value: group.steps, label: "steps" })) {
      requireText({ value: step.title, label: "step title" });
      requireText({ value: step.text, label: "step text" });
      checkReferences({ values: step.evidence, ids: evidenceIds, label: "step evidence" });
    }
    for (const run of requireArray({ value: group.dryRuns, label: "dryRuns" })) {
      if (!["reasoned", "executed"].includes(run.kind))
        throw new Error("A dry run must identify reasoned or executed evidence.");
      for (const key of ["title", "input", "outcome"])
        requireText({ value: run[key], label: "dry run " + key });
      if (run.kind === "executed")
        requireText({ value: run.command, label: "executed check command" });
      for (const step of requireArray({ value: run.steps, label: "dry run steps" })) {
        for (const key of ["branch", "state", "effects", "outcome"])
          requireText({ value: step[key], label: "dry run " + key });
        checkReferences({ values: step.evidence, ids: evidenceIds, label: "dry run evidence" });
        if (!step.evidence.length) throw new Error("Every dry run transition needs code evidence.");
      }
    }
    const diagram = requireObject({ value: group.diagram, label: "diagram" });
    const nodes = requireArray({ value: diagram.nodes, label: "diagram nodes" });
    const nodeIds = uniqueIds({ items: nodes, label: "diagram node" });
    for (const node of nodes) {
      requireText({ value: node.label, label: "node label" });
      checkReferences({ values: node.evidence, ids: evidenceIds, label: "node evidence" });
      if (!node.evidence.length) throw new Error("Every diagram node needs code evidence.");
    }
    for (const edge of requireArray({ value: diagram.edges, label: "diagram edges" })) {
      if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to))
        throw new Error("A diagram edge needs existing nodes.");
      requireText({ value: edge.label, label: "edge label" });
      checkReferences({ values: edge.evidence, ids: evidenceIds, label: "edge evidence" });
      if (!edge.evidence.length) throw new Error("Every diagram transition needs code evidence.");
    }
  }
  const proposals = requireArray({ value: report.proposals, label: "proposals" });
  uniqueIds({ items: proposals, label: "proposal" });
  for (const proposal of proposals) {
    if (
      !prIds.has(proposal.pr) ||
      !groupIds.has(proposal.group) ||
      !evidenceIds.has(proposal.evidence)
    )
      throw new Error("A proposal needs an existing PR, group, and evidence.");
    for (const key of ["body", "reason", "verification", "counterevidence"])
      requireText({ value: proposal[key], label: "proposal " + key });
    if (evidence.find((item) => item.id === proposal.evidence).pr !== proposal.pr)
      throw new Error("A proposal must identify the PR that owns its anchor.");
  }
  requireArray({ value: report.coverage, label: "coverage" });
  return report;
}
