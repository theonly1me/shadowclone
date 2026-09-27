import { Command } from "commander";
import { z } from "zod";
import { runGuidanceEvaluation, guidanceReport } from "../eval/guidance";
import { guidanceProtocols } from "../eval/guidance/schema";

const optionsSchema = z.object({
  protocol: z.enum(guidanceProtocols),
  engine: z.enum(["claude-code", "codex"]).optional(),
  repo: z.string().min(1),
  model: z.string().regex(/^(?:claude-sonnet-5(?:[.-][a-z0-9-]+)?|gpt-6-luna)$/),
  reasoningEffort: z.literal("medium"),
  maxBudgetUsd: z.coerce.number().positive().max(50).optional(),
  validationOf: z.uuid().optional(),
  cumulativeBudgetUsd: z.coerce.number().positive().max(10).optional(),
  maintenanceOf: z.uuid().optional(),
  comparisonOf: z.uuid().optional(),
  additionalBudgetUsd: z.coerce.number().positive().max(20).optional(),
  maxCalls: z.coerce.number().int().positive().max(128),
  deadlineSeconds: z.coerce.number().int().positive().max(14400),
  pilot: z.boolean().default(false),
  scenarioFile: z.string().optional(),
  memorySource: z.string().optional(),
  memoryManifest: z.string().optional(),
  suiteId: z.uuid().optional(),
  evalId: z.uuid().optional(),
  recoverPreflightFailure: z.boolean().default(false),
  failedCliVersion: z.string().min(1).optional(),
  yes: z.literal(true),
});

export function parseGuidanceArguments(argumentsList: readonly string[]) {
  const program = new Command().exitOverride().allowUnknownOption(false)
    .requiredOption("--protocol <name>")
    .option("--engine <id>")
    .requiredOption("--repo <path>")
    .requiredOption("--model <id>")
    .requiredOption("--reasoning-effort <level>")
    .option("--max-budget-usd <amount>")
    .option("--validation-of <eval-id>")
    .option("--cumulative-budget-usd <amount>")
    .option("--maintenance-of <eval-id>")
    .option("--comparison-of <eval-id>")
    .option("--additional-budget-usd <amount>")
    .requiredOption("--max-calls <number>")
    .requiredOption("--deadline-seconds <number>")
    .option("--pilot")
    .option("--scenario-file <path>")
    .option("--memory-source <path>")
    .option("--memory-manifest <path>")
    .option("--suite-id <id>")
    .option("--eval-id <id>")
    .option("--recover-preflight-failure")
    .option("--failed-cli-version <version>")
    .option("-y, --yes");
  program.parse([...argumentsList], { from: "user" });
  const options = optionsSchema.parse(program.opts());
  if (options.engine === "codex" && (options.protocol !== "guidance-skills-v1" || options.model !== "gpt-6-luna" || options.validationOf || options.maintenanceOf || options.comparisonOf || options.recoverPreflightFailure)) throw new Error("Codex guidance runs require the skills protocol with GPT 6 Luna and a fresh or ordinary frozen run");
  if (options.engine !== "codex" && options.model === "gpt-6-luna") throw new Error("GPT 6 Luna requires --engine codex");
  if ([Boolean(options.scenarioFile), Boolean(options.suiteId && !options.maintenanceOf), Boolean(options.evalId), Boolean(options.validationOf), Boolean(options.maintenanceOf), Boolean(options.comparisonOf)].filter(Boolean).length !== 1) throw new Error("Choose a scenario file, frozen suite, receipt resume, linked validation, maintenance, or comparison");
  if (!options.scenarioFile && (options.memorySource || options.memoryManifest)) throw new Error("Frozen runs cannot override memory sources");
  if (options.comparisonOf) {
    if (!options.additionalBudgetUsd || options.maxBudgetUsd !== undefined || options.cumulativeBudgetUsd !== undefined || options.pilot || options.recoverPreflightFailure ||
      options.maxCalls > 96 || options.deadlineSeconds > 5400 || options.model !== "claude-sonnet-5") throw new Error("Comparison requires an additional budget, at most 96 calls and 90 minutes, with exact Sonnet 5");
  } else if (options.maintenanceOf) {
    if (!options.suiteId || !options.additionalBudgetUsd || options.additionalBudgetUsd > 10 || options.maxBudgetUsd !== undefined || options.cumulativeBudgetUsd !== undefined || options.pilot || options.recoverPreflightFailure ||
      options.maxCalls > 48 || options.deadlineSeconds > 2700 || options.model !== "claude-sonnet-5") throw new Error("Maintenance requires a frozen suite and additional budget, at most 48 calls and 45 minutes, with exact Sonnet 5");
  } else if (options.additionalBudgetUsd !== undefined) throw new Error("Additional budget requires --maintenance-of or --comparison-of");
  else if (options.validationOf) {
    if (!options.cumulativeBudgetUsd || options.maxBudgetUsd !== undefined || options.pilot || options.recoverPreflightFailure || options.maxCalls > 48 || options.deadlineSeconds > 2700) throw new Error("Validation requires a cumulative budget, at most 48 calls and 45 minutes, without pilot or recovery overrides");
  } else if (options.maxBudgetUsd === undefined || options.cumulativeBudgetUsd !== undefined) throw new Error("Ordinary evaluations require --max-budget-usd, not a cumulative budget");
  if (options.pilot && options.maxBudgetUsd !== undefined && options.maxBudgetUsd > 5) throw new Error("Pilot budget cannot exceed $5");
  if (options.recoverPreflightFailure && (!options.evalId || !options.failedCliVersion)) throw new Error("Preflight recovery requires --eval-id and the observed --failed-cli-version");
  if (!options.recoverPreflightFailure && options.failedCliVersion) throw new Error("Failed CLI version is only used for explicit preflight recovery");
  if (options.protocol === "guidance-v1" && options.scenarioFile && !options.memoryManifest) throw new Error("guidance-v1 requires --memory-manifest");
  if (options.protocol !== "guidance-v1" && options.memoryManifest) throw new Error("Current guidance captures memory without a migration manifest");
  return { ...options, maximumCalls: options.maxCalls };
}

export async function guidanceEvalCommand(argumentsList: readonly string[]): Promise<void> {
  const receipt = await runGuidanceEvaluation(parseGuidanceArguments(argumentsList));
  console.log(JSON.stringify(guidanceReport(receipt), null, 2));
  if (receipt.status !== "complete") process.exitCode = 1;
}
