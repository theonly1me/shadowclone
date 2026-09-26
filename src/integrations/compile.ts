import { readEffectiveConfig } from "../config";
import { projectPaths } from "../paths";
import {
  compileProfile,
  profileScopePaths,
  readProfileDiagnostics,
  type ProfileCompilation,
  type ProfileCompilationAudience,
  type ProfileCompilationFormat,
  type ProfileDiagnostics,
} from "../profile";
import { referenceScopeRoots } from "../references";
import { isOriginBlocked, resolveRepository } from "../signal";
import { readNativeGuidance } from "./nativeGuidance";
import type { IntegrationOptions } from "./types";

export type CompiledContext = {
  readonly compilation: ProfileCompilation;
  readonly scopeFiles: readonly string[];
  readonly referenceRoots: readonly string[];
  readonly diagnostics: ProfileDiagnostics;
};

type ContextOptions = IntegrationOptions & {
  readonly cwd: string;
  readonly scope?: "global" | "scoped" | "combined";
  readonly audience?: ProfileCompilationAudience;
  readonly format?: ProfileCompilationFormat;
  readonly nativeDuplicates?: boolean;
};

export async function compileContextDetails(options: ContextOptions): Promise<CompiledContext | null> {
  const paths = options.paths ?? projectPaths;
  const { config, policy } = await readEffectiveConfig({
    configPath: options.configPath ?? paths.configFile,
    managedConfigPath: options.managedConfigPath === undefined ? paths.managedConfigFile : options.managedConfigPath,
  });
  if (!policy.enabled) return null;
  const repository = options.scope === "global" ? null : await resolveRepository({
    cwd: options.cwd,
    enabled: config.sources["git-metadata"],
    readRemote: options.readRemote,
  });
  if (repository && isOriginBlocked({ repository, patterns: policy.blockedOrigins })) return null;
  const location = {
    origin: repository?.origin ?? null,
    targetRepo: repository?.profileFileName ?? null,
    scope: options.scope,
  };
  const compilation = await compileProfile({
    input: {
      kind: "directory",
      profileDirectory: paths.profileDirectory,
      ...location,
    },
    audience: options.audience,
    format: options.format,
    knownNativeText: options.nativeDuplicates && config.sources["declared-rules"]
      ? await readNativeGuidance(options.cwd)
      : [],
  });
  return {
    compilation,
    scopeFiles: profileScopePaths(location),
    referenceRoots: options.audience === "subagent" ? [] : referenceScopeRoots(location),
    diagnostics: await readProfileDiagnostics(paths.profileDirectory),
  };
}

export async function compileContext(options: ContextOptions): Promise<string | null> {
  return (await compileContextDetails(options))?.compilation.markdown ?? null;
}
