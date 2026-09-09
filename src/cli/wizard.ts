import type { ProjectPaths } from "../paths";
import { projectPaths } from "../paths";
import type {
  SeedAgentSkill,
  SeedGuidance,
  SeedLibrary,
} from "../skills";
import {
  loadSeedLibrary,
  writeSeedGuidanceSelection,
} from "../skills";
import { type ConfirmPrompt, promptConfirmation } from "./confirm";

export type WizardAnswerPrompt = (
  question: string,
) => string | null | Promise<string | null>;

export type WizardResult = {
  readonly written: boolean;
  readonly selectedGuidanceIds: readonly string[];
};

function promptForAnswer(question: string): string | null {
  return prompt(question);
}

function numberedChoices<T extends SeedGuidance>(guidance: readonly T[]): readonly {
  readonly number: string;
  readonly entry: T;
}[] {
  return guidance.map((entry, choiceIndex) => ({
    number: String(choiceIndex + 1),
    entry,
  }));
}

export function parseAxisChoice(options: {
  readonly response: string;
  readonly guidance: readonly SeedGuidance[];
}): SeedGuidance | null {
  const choices = numberedChoices(options.guidance);
  const response = options.response.trim();
  const allowed = new Set(choices.map((choice) => choice.number));
  if (!allowed.has(response)) {
    return null;
  }
  return choices.find((choice) => choice.number === response)?.entry ?? null;
}

export function parseOptionalSkillChoices(options: {
  readonly response: string;
  readonly skills: readonly SeedAgentSkill[];
}): readonly SeedAgentSkill[] | null {
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
    .map((choice) => choice.entry);
}

function choiceQuestion<T extends SeedGuidance>(options: {
  readonly heading: string;
  readonly guidance: readonly T[];
  readonly suffix?: string;
}): string {
  return [
    options.heading,
    ...numberedChoices(options.guidance).map(
      (choice) => `  ${choice.number}. ${choice.entry.title}`,
    ),
    ...(options.suffix ? [options.suffix] : []),
  ].join("\n");
}

async function chooseAxis(options: {
  readonly axisId: string;
  readonly guidance: readonly SeedGuidance[];
  readonly answer: WizardAnswerPrompt;
  readonly writeLine: (line: string) => void;
}): Promise<SeedGuidance> {
  const question = choiceQuestion({
    heading: `Choose one for ${options.axisId}:`,
    guidance: options.guidance,
  });
  for (;;) {
    const response = await options.answer(question);
    if (response === null) {
      throw new Error("Wizard cancelled before a choice was made");
    }
    const guidance = parseAxisChoice({ response, guidance: options.guidance });
    if (guidance) {
      return guidance;
    }
    options.writeLine("Choose one of the displayed numbers.");
  }
}

async function chooseOptionalSkills(options: {
  readonly skills: readonly SeedAgentSkill[];
  readonly answer: WizardAnswerPrompt;
  readonly writeLine: (line: string) => void;
}): Promise<readonly SeedAgentSkill[]> {
  const question = choiceQuestion({
    heading: "Choose optional skills:",
    guidance: options.skills,
    suffix: "Enter all, none, or comma-separated numbers.",
  });
  for (;;) {
    const response = await options.answer(question);
    if (response === null) {
      throw new Error("Wizard cancelled before optional skills were chosen");
    }
    const skills = parseOptionalSkillChoices({
      response,
      skills: options.skills,
    });
    if (skills !== null) {
      return skills;
    }
    options.writeLine("Choose all, none, or unique displayed numbers.");
  }
}

export async function runWizard(options: {
  readonly paths?: ProjectPaths;
  readonly library?: SeedLibrary;
  readonly answer?: WizardAnswerPrompt;
  readonly confirm?: ConfirmPrompt;
  readonly writeLine?: (line: string) => void;
} = {}): Promise<WizardResult> {
  const paths = options.paths ?? projectPaths;
  const library = options.library ?? await loadSeedLibrary();
  const answer = options.answer ?? promptForAnswer;
  const confirm = options.confirm ?? promptConfirmation;
  const writeLine = options.writeLine ?? ((line) => console.log(line));
  const selected: SeedGuidance[] = [];

  for (const axis of library.axes) {
    selected.push(
      await chooseAxis({
        axisId: axis.id,
        guidance: axis.guidance,
        answer,
        writeLine,
      }),
    );
  }
  selected.push(
    ...await chooseOptionalSkills({
      skills: library.independentSkills,
      answer,
      writeLine,
    }),
  );

  writeLine("Selected profile rules:");
  for (const entry of selected) {
    writeLine(`  ${entry.title}`);
  }
  const selectedGuidanceIds = selected.map((entry) => entry.id);
  if (!(await confirm("Write these rules to your profile?"))) {
    writeLine("Profile unchanged.");
    return { written: false, selectedGuidanceIds };
  }

  await writeSeedGuidanceSelection({
    paths,
    library,
    selectedGuidance: selected,
  });
  writeLine(`Profile updated with ${selected.length} declared rules.`);
  return { written: true, selectedGuidanceIds };
}
