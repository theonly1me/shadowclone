import os from "node:os";
import path from "node:path";

const runtimeModulePaths: Bun.BunPlugin = {
  name: "runtime-module-paths",
  setup(build) {
    build.onLoad({ filter: /[/\\]typescript[/\\]lib[/\\]typescript\.js$/ }, async ({ path: modulePath }) => ({
      contents: `const __dirname = import.meta.dir; const __filename = import.meta.path;\n${await Bun.file(modulePath).text()}`,
      loader: "js",
    }));
  },
};

export async function buildRuntimeBundle(entryPoint: string): Promise<Bun.BuildArtifact> {
  const result = await Bun.build({
    entrypoints: [entryPoint], target: "bun", minify: true, plugins: [runtimeModulePaths],
  });
  const [bundle] = result.outputs;
  if (!result.success || !bundle) throw new Error("Runtime bundle failed to build");
  const text = await bundle.text();
  const privateRoots = [process.cwd(), os.homedir(), path.dirname(path.resolve(entryPoint))];
  if (privateRoots.some((root) => text.includes(root))) throw new Error("Runtime bundle contains a build-machine path");
  return bundle;
}
