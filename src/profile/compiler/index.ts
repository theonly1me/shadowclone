import { mkdir } from "node:fs/promises";
import path from "node:path";
import { seedGuidanceProfileKey } from "../../skills/key";
import { loadSeedLibrary } from "../../skills/library";
import { compilerBlocksFromRules, readCompilerBlocks } from "./read";
import { defaultProfileByteBudget, renderCompilation } from "./render";
import { selectCompilerBlocks } from "./select";
import type {
  CompilerBlock,
  ProfileCompilation,
  ProfileCompileInput,
} from "./types";

export { defaultProfileByteBudget } from "./render";
export type {
  ProfileCompilation,
  ProfileCompilationOmission,
  ProfileCompilationOmissionReason,
  ProfileCompileInput,
} from "./types";

const seedKeyPrefix = "seed:";

async function seedAxes(
  blocks: readonly CompilerBlock[],
): Promise<ReadonlyMap<string, string>> {
  const carriesSeedGuidance = blocks.some(
    (block) => block.ruleKey?.startsWith(seedKeyPrefix),
  );
  if (!carriesSeedGuidance) {
    return new Map();
  }
  const axes = new Map<string, string>();
  try {
    const library = await loadSeedLibrary();
    for (const axis of library.axes) {
      for (const guidance of axis.guidance) {
        axes.set(seedGuidanceProfileKey(guidance.id), axis.id);
      }
    }
  } catch {
    return new Map();
  }
  return axes;
}

function compilerBlocks(
  input: ProfileCompileInput,
): Promise<readonly CompilerBlock[]> {
  return input.kind === "rules"
    ? Promise.resolve(compilerBlocksFromRules(input.rules))
    : readCompilerBlocks({
        profileDirectory: input.profileDirectory,
        origin: input.origin,
        targetRepo: input.targetRepo,
      });
}

export async function compileProfile(options: {
  readonly input: ProfileCompileInput;
  readonly outputPath?: string;
  readonly byteBudget?: number;
}): Promise<ProfileCompilation> {
  const blocks = await compilerBlocks(options.input);
  const selection = selectCompilerBlocks({
    blocks,
    axes: await seedAxes(blocks),
  });
  const compilation = renderCompilation({
    blocks: selection.selected,
    byteBudget: options.byteBudget ?? defaultProfileByteBudget,
  });
  if (options.outputPath !== undefined) {
    await mkdir(path.dirname(options.outputPath), { recursive: true });
    await Bun.write(options.outputPath, compilation.markdown);
  }
  return {
    ...compilation,
    omissions: [...selection.omissions, ...compilation.omissions],
  };
}
