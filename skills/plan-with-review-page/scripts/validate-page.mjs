#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
const mermaidUrl = "https://cdn.jsdelivr.net/npm/mermaid@12.1.0/dist/mermaid.min.js";
const mermaidIntegrity = "sha384-EbBpjO7rlR6eqZEcG7GaPpyk9H9WrMyPWX4d3KvPYltgt8Z8l0z6R56B1qP40pR4";
const planStatuses = ["draft", "approved", "in progress", "done"];
const requiredText = ["title", "summary", "planPath", "updated", "problem.statement", "problem.impact", "approach"];
const listRules = {
  evidence: { minimum: 1, text: ["fact", "source"], choices: { kind: ["measured", "read", "inferred", "reported"] } },
  causes: { minimum: 1, text: ["id", "cause", "origin"] },
  ruledOut: { minimum: 0, text: ["cause", "reason"] },
  changes: { minimum: 1, text: ["id", "change", "worksBecause"], lists: ["files", "addresses"] },
  alternatives: { minimum: 1, text: ["option", "tradeoff"], choices: { verdict: ["rejected", "deferred"] } },
  risks: { minimum: 1, text: ["id", "risk", "mitigation"] },
  decisions: { minimum: 0, text: ["question", "answer", "reason"], choices: { source: ["user", "repository", "agent"] } },
  open: { minimum: 0, text: ["question", "blocks"] },
  steps: { minimum: 1, text: ["text"], choices: { status: ["todo", "doing", "done", "blocked", "skipped"] } },
  verification: { minimum: 1, text: ["check", "expected"], lists: ["proves"] },
};

function readPlan(html) {
  const blocks = [
    ...html.matchAll(/<script type="application\/json" id="plan">([\s\S]*?)<\/script>/g),
  ];

  if (blocks.length !== 1) {
    return {
      error: `found ${blocks.length} plan blocks, keep exactly one JSON block with the id plan`,
    };
  }

  try {
    return { plan: JSON.parse(blocks[0][1]) };
  } catch (error) {
    return { error: `the plan block is not valid JSON: ${error.message}` };
  }
}

function textValues(value, at) {
  if (typeof value === "string") {
    return [[at, value]];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => textValues(entry, `${at}[${index}]`));
  }

  const entries = value !== null && typeof value === "object" ? Object.entries(value) : [];

  return entries.flatMap(([key, entry]) => textValues(entry, at ? `${at}.${key}` : key));
}

const filled = (value) => typeof value === "string" && value.trim().length > 0;
const filledList = (value) => Array.isArray(value) && value.length > 0 && value.every(filled);
const entriesOf = (plan, name) => (Array.isArray(plan[name]) ? plan[name] : []);

function entryErrors({ name, rule, plan }) {
  if (!Array.isArray(plan[name])) {
    return [`${name} must be a list`];
  }

  if (plan[name].length < rule.minimum) {
    return [`${name} must list at least ${rule.minimum}`];
  }

  return plan[name].flatMap((entry, index) => [
    ...rule.text.filter((key) => !filled(entry?.[key])).map((key) => `${name}[${index}].${key} must be filled in`),
    ...(rule.lists ?? []).filter((key) => !filledList(entry?.[key])).map((key) => `${name}[${index}].${key} must list at least one value`),
    ...Object.entries(rule.choices ?? {})
      .filter(([key, choices]) => !choices.includes(entry?.[key]))
      .map(([key, choices]) => `${name}[${index}].${key} must be one of ${choices.join(", ")}`),
  ]);
}

function referenceErrors(plan) {
  const causeIds = entriesOf(plan, "causes").map((cause) => cause?.id);
  const knownIds = [...causeIds, ...entriesOf(plan, "risks").map((risk) => risk?.id)];
  const errors = [];

  for (const name of ["causes", "changes", "risks"]) {
    const ids = entriesOf(plan, name).map((entry) => entry?.id);
    const repeated = ids.filter((id, index) => filled(id) && ids.indexOf(id) !== index);
    errors.push(...[...new Set(repeated)].map((id) => `${name} use the id ${id} more than once`));
  }

  for (const [name, key] of [["changes", "addresses"], ["verification", "proves"]]) {
    for (const [index, entry] of entriesOf(plan, name).entries()) {
      const unknown = (Array.isArray(entry?.[key]) ? entry[key] : []).filter((id) => !knownIds.includes(id));

      errors.push(...unknown.map((id) => `${name}[${index}].${key} names ${id}, which is not a cause or risk id`));
    }
  }

  for (const id of causeIds.filter(filled)) {
    if (!entriesOf(plan, "changes").some((change) => change?.addresses?.includes?.(id))) {
      errors.push(`cause ${id} has no change that addresses it`);
    }

    if (!entriesOf(plan, "verification").some((check) => check?.proves?.includes?.(id))) {
      errors.push(`cause ${id} has no check that proves the fix`);
    }
  }

  return errors;
}

function validate(html) {
  const { plan, error } = readPlan(html);

  if (error) {
    return [error];
  }

  const errors = requiredText
    .filter((at) => !filled(at.split(".").reduce((value, key) => value?.[key], plan)))
    .map((at) => `${at} must be filled in`);

  if (!planStatuses.includes(plan.status)) {
    errors.push(`status must be one of ${planStatuses.join(", ")}`);
  }

  for (const [name, rule] of Object.entries(listRules)) {
    errors.push(...entryErrors({ name, rule, plan }));
  }

  for (const [index, step] of entriesOf(plan, "steps").entries()) {
    if ((step?.status === "skipped" || step?.status === "blocked") && !filled(step.note)) {
      errors.push(`steps[${index}] is ${step.status}, so its note must give the reason`);
    }
  }

  errors.push(...referenceErrors(plan));

  if (!Array.isArray(plan.followUps) || !plan.followUps.every(filled)) {
    errors.push("followUps must be a list of one-line follow-ups, or empty");
  }

  if (typeof plan.diagram !== "string") {
    errors.push("diagram must be Mermaid source, or empty when there is no diagram");
  }

  for (const [at, text] of textValues(plan, "")) {
    if (text.startsWith("TEMPLATE:")) {
      errors.push(`${at} still has template text, replace it`);
    }

    if (dashes.test(text)) {
      errors.push(`${at} has an em or en dash, use a comma, a period, or parentheses`);
    }
  }

  for (const [url] of html.matchAll(/https?:\/\/[^\s"'<>)]+/g)) {
    if (url !== mermaidUrl) {
      errors.push(`${url} loads from the network, keep the page self-contained`);
    }
  }

  if (html.includes(mermaidUrl) && !html.includes(mermaidIntegrity)) {
    errors.push("the Mermaid script must keep its pinned integrity hash");
  }

  return errors;
}

async function main(files) {
  if (files.length === 0) {
    console.error("Usage: validate-page.mjs <page.html>...");

    return 2;
  }

  let total = 0;

  for (const file of files) {
    let html;

    try {
      html = await readFile(file, "utf8");
    } catch (error) {
      console.error(`${file}: cannot read the file (${error.code ?? error.message})`);

      return 2;
    }

    for (const message of validate(html)) {
      console.log(`${file}: error ${message}`);
      total += 1;
    }
  }

  const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

  console.log(`validate-page: ${plural(total, "error")} in ${plural(files.length, "file")}`);

  return total > 0 ? 1 : 0;
}

process.exitCode = await main(process.argv.slice(2));
