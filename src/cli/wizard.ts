import { promptConfirmation, type ConfirmPrompt } from "./confirm";
import { projectPaths } from "../paths";
import type { ProjectPaths } from "../paths";
import {
  loadSeedSkillLibrary,
  writeSeedSkillSelection,
} from "../skills";
import type {
  SeedSkill,
  SeedSkillLibrary,
} from "../skills";

export type WizardAnswerPrompt = (
  question: string,
) => string | null | Promise<string | null>;

export type WizardResult = {
  readonly written: boolean;
  readonly selectedSkillIds: readonly string[];
};

function promptForAnswer(question: string): string | null {
  return prompt(question);
}

function numberedChoices(skills: readonly SeedSkill[]): readonly {
  readonly number: string;
  readonly skill: SeedSkill;
}[] {
  return skills.map((skill, choiceIndex) => ({
    number: String(choiceIndex + 1),
    skill,
  }));
}

export function parseAxisChoice(options: {
  readonly response: string;
  readonly skills: readonly SeedSkill[];
}): SeedSkill | null {
  const choices = numberedChoices(options.skills);
  const response = options.response.trim();
  const allowed = new Set(choices.map((choice) => choice.number));
  if (!allowed.has(response)) {
    return null;
  }
  return choices.find((choice) => choice.number === response)?.skill ?? null;
}

export function parseDisciplineChoices(options: {
  readonly response: string;
  readonly skills: readonly SeedSkill[];
}): readonly SeedSkill[] | null {
  const response = options.response.trim();
  if (response === "all") {
    return options.skills;
  }
  if (response === "none") {
    return [];
  }
  const choices = numberedChoices(options.skills);
  const allowed = new Set(choices.map((choice) => choice.number));
  const requested = response.split(",").map((value) => value.trim());
  const unique = new Set(requested);
  if (
    requested.length === 0 ||
    requested.length !== unique.size ||
    requested.some((value) => !allowed.has(value))
  ) {
    return null;
  }
  return choices
    .filter((choice) => unique.has(choice.number))
    .map((choice) => choice.skill);
}

function choiceQuestion(options: {
  readonly heading: string;
  readonly skills: readonly SeedSkill[];
  readonly suffix?: string;
}): string {
  return [
    options.heading,
    ...numberedChoices(options.skills).map(
      (choice) => `  ${choice.number}. ${choice.skill.title}`,
    ),
    ...(options.suffix ? [options.suffix] : []),
  ].join("\n");
}

async function chooseAxis(options: {
  readonly axisId: string;
  readonly skills: readonly SeedSkill[];
  readonly answer: WizardAnswerPrompt;
  readonly writeLine: (line: string) => void;
}): Promise<SeedSkill> {
  const question = choiceQuestion({
    heading: `Choose one for ${options.axisId}:`,
    skills: options.skills,
  });
  for (;;) {
    const response = await options.answer(question);
    if (response === null) {
      throw new Error("Wizard cancelled before a choice was made");
    }
    const skill = parseAxisChoice({ response, skills: options.skills });
    if (skill) {
      return skill;
    }
    options.writeLine("Choose one of the displayed numbers.");
  }
}

async function chooseDisciplines(options: {
  readonly skills: readonly SeedSkill[];
  readonly answer: WizardAnswerPrompt;
  readonly writeLine: (line: string) => void;
}): Promise<readonly SeedSkill[]> {
  const question = choiceQuestion({
    heading: "Choose disciplines:",
    skills: options.skills,
    suffix: "Enter all, none, or comma-separated numbers.",
  });
  for (;;) {
    const response = await options.answer(question);
    if (response === null) {
      throw new Error("Wizard cancelled before disciplines were chosen");
    }
    const skills = parseDisciplineChoices({ response, skills: options.skills });
    if (skills !== null) {
      return skills;
    }
    options.writeLine("Choose all, none, or unique displayed numbers.");
  }
}

export async function runWizard(options: {
  readonly paths?: ProjectPaths;
  readonly library?: SeedSkillLibrary;
  readonly answer?: WizardAnswerPrompt;
  readonly confirm?: ConfirmPrompt;
  readonly writeLine?: (line: string) => void;
} = {}): Promise<WizardResult> {
  const paths = options.paths ?? projectPaths;
  const library = options.library ?? await loadSeedSkillLibrary();
  const answer = options.answer ?? promptForAnswer;
  const confirm = options.confirm ?? promptConfirmation;
  const writeLine = options.writeLine ?? ((line) => console.log(line));
  const selected: SeedSkill[] = [];

  for (const axis of library.axes) {
    selected.push(
      await chooseAxis({
        axisId: axis.id,
        skills: axis.skills,
        answer,
        writeLine,
      }),
    );
  }
  selected.push(
    ...await chooseDisciplines({
      skills: library.disciplines,
      answer,
      writeLine,
    }),
  );

  writeLine("Selected profile rules:");
  for (const skill of selected) {
    writeLine(`  ${skill.title}`);
  }
  const selectedSkillIds = selected.map((skill) => skill.id);
  if (!(await confirm("Write these rules to your profile?"))) {
    writeLine("Profile unchanged.");
    return { written: false, selectedSkillIds };
  }

  await writeSeedSkillSelection({ paths, library, selectedSkills: selected });
  writeLine(`Profile updated with ${selected.length} declared rules.`);
  return { written: true, selectedSkillIds };
}
