import path from "node:path";
import { readdir } from "node:fs/promises";
import { skillQualityFindings, type SkillFinding, type SkillRule } from "../src/skills/quality";
import { readSkillDocument } from "../src/skills/qualityDocument";
import { pendingSkillNames, permanentRuleExemptions } from "../src/skills/qualityExceptions";

export type SkillQualityReport = {
  readonly checkedSkillCount: number;
  readonly pendingSkillCount: number;
  readonly findings: readonly SkillFinding[];
};

type BundledSkill = {
  readonly name: string;
  readonly text: string;
  readonly files: readonly string[];
};

const minimumSharedSentenceWords = 8;

async function listSkillFiles(directory: string): Promise<readonly string[]> {
  const files: string[] = [];

  for await (const file of new Bun.Glob("**/*").scan({ cwd: directory, onlyFiles: true })) {
    files.push(file);
  }

  return files.sort();
}

async function readBundledSkills(skillsDirectory: string): Promise<readonly BundledSkill[]> {
  const entries = await readdir(skillsDirectory, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    names.map(async (name) => {
      const directory = path.join(skillsDirectory, name);

      return {
        name,
        text: await Bun.file(path.join(directory, "SKILL.md")).text(),
        files: await listSkillFiles(directory),
      };
    }),
  );
}

function sentencesOf(text: string): readonly string[] {
  const document = readSkillDocument(text);
  const prose = (document?.bodyLines ?? [])
    .map((line) => line.text)
    .filter((line) => !line.startsWith("#"))
    .join(" ")
    .replace(/\s+/g, " ");

  return prose
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim().toLowerCase())
    .filter((sentence) => sentence.split(" ").length >= minimumSharedSentenceWords);
}

function repeatedSentenceFindings(skills: readonly BundledSkill[]): readonly SkillFinding[] {
  const owners = new Map<string, Set<string>>();

  for (const skill of skills) {
    for (const sentence of sentencesOf(skill.text)) {
      const names = owners.get(sentence) ?? new Set<string>();

      names.add(skill.name);
      owners.set(sentence, names);
    }
  }

  return [...owners.entries()]
    .filter(([, names]) => names.size > 2)
    .map(([sentence, names]): SkillFinding => {
      const [first = ""] = [...names];

      return {
        skill: first,
        line: 1,
        rule: "repeated-sentence",
        message: `"${sentence.slice(0, 60)}..." appears in ${[...names].join(", ")}, keep shared text in at most two skills`,
      };
    });
}

async function scriptFindings(options: {
  readonly rootDirectory: string;
  readonly skill: BundledSkill;
}): Promise<readonly SkillFinding[]> {
  const findings: SkillFinding[] = [];
  const scripts = options.skill.files.filter((file) => /^scripts\/[^/]+\.mjs$/.test(file));

  for (const script of scripts) {
    const stem = path.basename(script, ".mjs");
    const text = await Bun.file(
      path.join(options.rootDirectory, "skills", options.skill.name, script),
    ).text();
    const imported = [...text.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)].map(
      (match) => match[1] ?? "",
    );
    const external = imported.filter((specifier) => !/^(?:node:|\.\.?\/)/.test(specifier));
    const testFile = path.join("src", "skills", "scripts", `${options.skill.name}.${stem}.test.ts`);
    const at = { skill: options.skill.name, line: 1, rule: "script" } as const;

    if (external.length > 0) {
      findings.push({
        ...at,
        message: `${script} imports ${external.join(", ")}, use only node: modules`,
      });
    }

    if (!(await Bun.file(path.join(options.rootDirectory, testFile)).exists())) {
      findings.push({ ...at, message: `${script} needs a test at ${testFile}` });
    }
  }

  return findings;
}

export async function findSkillQualityViolations(options: {
  readonly rootDirectory: string;
  readonly pending?: ReadonlySet<string>;
  readonly exemptions?: ReadonlyMap<string, readonly SkillRule[]>;
}): Promise<SkillQualityReport> {
  const pending = options.pending ?? pendingSkillNames;
  const exemptions = options.exemptions ?? permanentRuleExemptions;
  const skills = await readBundledSkills(path.join(options.rootDirectory, "skills"));
  const bundledNames = skills.map((skill) => skill.name);
  const findings: SkillFinding[] = [];

  for (const name of pending) {
    if (!bundledNames.includes(name)) {
      findings.push({
        skill: name,
        line: 1,
        rule: "pending-list",
        message: "is not a bundled skill, remove it from pendingSkillNames",
      });
    }
  }

  for (const skill of skills) {
    const skillFindings = [
      ...skillQualityFindings({
        name: skill.name,
        text: skill.text,
        bundledNames,
        files: skill.files,
        exemptions: exemptions.get(skill.name) ?? [],
      }),
      ...(await scriptFindings({ rootDirectory: options.rootDirectory, skill })),
    ];

    if (!pending.has(skill.name)) {
      findings.push(...skillFindings);
    } else if (skillFindings.length === 0) {
      findings.push({
        skill: skill.name,
        line: 1,
        rule: "pending-list",
        message: "meets the bar, remove it from pendingSkillNames",
      });
    }
  }

  findings.push(...repeatedSentenceFindings(skills.filter((skill) => !pending.has(skill.name))));

  return { checkedSkillCount: skills.length, pendingSkillCount: pending.size, findings };
}

if (import.meta.main) {
  const report = await findSkillQualityViolations({ rootDirectory: process.cwd() });

  for (const entry of report.findings) {
    console.log(`skills/${entry.skill}/SKILL.md:${entry.line} ${entry.rule} ${entry.message}`);
  }

  console.log(
    `skills: checked ${report.checkedSkillCount} skills (${report.pendingSkillCount} pending), found ${report.findings.length} findings`,
  );

  if (report.findings.length > 0) {
    process.exitCode = 1;
  }
}
