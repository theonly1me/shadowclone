import { expect, test } from "bun:test";
import { mkdtemp, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { seedSkillsDirectory } from "@shadowclone/core";

const skillDirectory = path.join(await seedSkillsDirectory(), "plan-with-review-page");
const validator = path.join(skillDirectory, "scripts/validate-page.mjs");
const template = path.join(skillDirectory, "assets/review-page.html");
const runtimes = [process.execPath, Bun.which("node")].flatMap((runtime) =>
  runtime ? [runtime] : [],
);
const emDash = String.fromCharCode(0x2014);

const filledPlan = {
  title: "Keep edited skills during sync",
  status: "draft",
  summary: "Sync keeps a skill copy that the user edited and lists it. Users stop losing edits.",
  planPath: "/tmp/agent-artifacts/example/2026-01-01-sync-edits/plan.md",
  updated: "2026-01-01 09:00",
  problem: {
    statement: "Sync replaces a skill copy that the user edited.",
    impact: "Each user who edits a bundled skill loses the edit at the next sync.",
  },
  evidence: [
    { fact: "Sync replaced an edited copy in a temporary home.", source: "bun test sync.test.ts", kind: "measured" },
  ],
  causes: [{ id: "C1", cause: "Sync compares the file name, not the fingerprint.", origin: "src/sync.ts:42" }],
  ruledOut: [{ cause: "A stale install record.", reason: "A fresh record gave the same result." }],
  approach: "Compare the fingerprint before a write, and keep a copy that differs.",
  changes: [
    { id: "F1", change: "Compare fingerprints.", files: ["src/sync.ts"], addresses: ["C1"], worksBecause: "An edited copy has a different fingerprint." },
    { id: "F2", change: "Accept old fingerprints.", files: ["src/versions.json"], addresses: ["R1"], worksBecause: "An old copy matches a recorded fingerprint." },
  ],
  alternatives: [
    { option: "Always save a backup.", tradeoff: "It keeps data but still changes the active copy.", verdict: "rejected" },
  ],
  risks: [{ id: "R1", risk: "A copy from an old version looks edited.", mitigation: "Accept each recorded bundled fingerprint." }],
  decisions: [{ question: "Edited copies?", answer: "Keep and list them.", source: "user", reason: "Edits are user work." }],
  open: [],
  steps: [
    { status: "done", text: "Read the sync code.", note: "" },
    { status: "skipped", text: "Measure the wizard.", note: "The wizard is out of scope." },
  ],
  verification: [{ check: "bun test sync.test.ts", expected: "The edited copy stays.", proves: ["C1"] }],
  followUps: ["Show kept copies in the wizard."],
  diagram: "flowchart LR\n  Sync --> Fingerprint",
};

async function page(options: {
  readonly plan?: unknown;
  readonly change?: (html: string) => string;
}): Promise<string> {
  const html = await Bun.file(template).text();
  const withPlan =
    options.plan === undefined
      ? html
      : html.replace(
          /(<script type="application\/json" id="plan">)[\s\S]*?(<\/script>)/,
          (_, open, close) => `${open}\n${JSON.stringify(options.plan, null, 2)}\n${close}`,
        );
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "shadowclone-page-")));
  const filePath = path.join(directory, "index.html");

  await Bun.write(filePath, options.change ? options.change(withPlan) : withPlan);

  return filePath;
}

function validate(options: { readonly runtime: string; readonly files: readonly string[] }) {
  const result = Bun.spawnSync([options.runtime, validator, ...options.files], {
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: result.exitCode,
    lines: result.stdout.toString().trim().split("\n"),
    error: result.stderr.toString().trim(),
  };
}

for (const runtime of runtimes) {
  const name = path.basename(runtime);

  test(`${name}: the template fails until each template value is replaced`, async () => {
    const result = validate({ runtime, files: [await page({})] });

    expect(result.exitCode).toBe(1);
    expect(result.lines.at(-1)).toBe("validate-page: 28 errors in 1 file");
    expect(
      result.lines.some((line) => line.endsWith("error title still has template text, replace it")),
    ).toBeTrue();
  });

  test(`${name}: a filled page passes`, async () => {
    const result = validate({ runtime, files: [await page({ plan: filledPlan })] });

    expect(result).toEqual({
      exitCode: 0,
      lines: ["validate-page: 0 errors in 1 file"],
      error: "",
    });
  });

  test(`${name}: a plan with only steps and decisions fails and names the missing sections`, async () => {
    const { title, planPath, updated, steps } = filledPlan;
    const decisions = [{ question: "Edited copies?", answer: "Keep and list them.", source: "user" }];
    const filePath = await page({
      plan: { title, planPath, updated, steps, decisions, open: [], followUps: [], diagram: "" },
    });
    const result = validate({ runtime, files: [filePath] });

    expect(result.exitCode).toBe(1);
    expect(result.lines).toEqual(
      expect.arrayContaining([
        `${filePath}: error summary must be filled in`,
        `${filePath}: error problem.statement must be filled in`,
        `${filePath}: error evidence must be a list`,
        `${filePath}: error causes must be a list`,
        `${filePath}: error alternatives must be a list`,
        `${filePath}: error decisions[0].reason must be filled in`,
      ]),
    );
  });

  test(`${name}: a cause without a change or a check, and an unknown cause id, are errors`, async () => {
    const filePath = await page({
      plan: {
        ...filledPlan,
        causes: [...filledPlan.causes, { id: "C2", cause: "Sync ignores the record.", origin: "src/sync.ts:60" }],
        verification: [{ ...filledPlan.verification[0], proves: ["C1", "C9"] }],
      },
    });
    const result = validate({ runtime, files: [filePath] });

    expect(result.exitCode).toBe(1);
    expect(result.lines).toEqual([
      `${filePath}: error verification[0].proves names C9, which is not a cause or risk id`,
      `${filePath}: error cause C2 has no change that addresses it`,
      `${filePath}: error cause C2 has no check that proves the fix`,
      "validate-page: 3 errors in 1 file",
    ]);
  });

  test(`${name}: a bad label, a skip without a reason, and a dash are errors`, async () => {
    const filePath = await page({
      plan: {
        ...filledPlan,
        summary: `Sync keeps edits ${emDash} and lists them.`,
        evidence: [{ ...filledPlan.evidence[0], kind: "certain" }],
        steps: [{ status: "skipped", text: "Measure the wizard.", note: "" }],
      },
    });
    const result = validate({ runtime, files: [filePath] });

    expect(result.exitCode).toBe(1);
    expect(result.lines).toEqual([
      `${filePath}: error evidence[0].kind must be one of measured, read, inferred, reported`,
      `${filePath}: error steps[0] is skipped, so its note must give the reason`,
      `${filePath}: error summary has an em or en dash, use a comma, a period, or parentheses`,
      "validate-page: 3 errors in 1 file",
    ]);
  });

  test(`${name}: another network script or a missing integrity hash fails`, async () => {
    const filePath = await page({
      plan: filledPlan,
      change: (html) =>
        html
          .replace("</body>", '<script src="https://example.com/tracker.js"></script>\n</body>')
          .replace(/sha384-[A-Za-z0-9+/=]+/, "sha384-removed"),
    });
    const result = validate({ runtime, files: [filePath] });

    expect(result.exitCode).toBe(1);
    expect(result.lines).toEqual([
      `${filePath}: error https://example.com/tracker.js loads from the network, keep the page self-contained`,
      `${filePath}: error the Mermaid script must keep its pinned integrity hash`,
      "validate-page: 2 errors in 1 file",
    ]);
  });

  test(`${name}: no file or a missing file stops with exit code 2`, async () => {
    const missing = path.join(os.tmpdir(), "shadowclone-page-missing.html");

    expect(validate({ runtime, files: [] })).toEqual({
      exitCode: 2,
      lines: [""],
      error: "Usage: validate-page.mjs <page.html>...",
    });
    expect(validate({ runtime, files: [missing] })).toEqual({
      exitCode: 2,
      lines: [""],
      error: `${missing}: cannot read the file (ENOENT)`,
    });
  });
}
