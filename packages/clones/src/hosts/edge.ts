export const supabase = ["npx", "--yes", "supabase@2.120.0"] as const;

export const functionName = "shadowclone";

function denoEntry(options: { readonly waitInBackground: boolean }): string {
  return `import { launchers, receiveWebhook, receiverRuntime } from "./shadowclone-receiver.js";

Deno.serve(async (request) => {
  const environment = Deno.env.toObject();
  const runtime = receiverRuntime(environment);
  const { response, started } = await receiveWebhook({
    request,
    settings: runtime.settings,
    start: (event) =>
      launchers[runtime.host]({
        image: runtime.image,
        environment: runtime.sandboxEnvironment(event),
        secrets: environment,
        fetch: (input, init) => fetch(input, init),
      }),
  });

  if (started) {
${options.waitInBackground ? '    Reflect.get(globalThis, "EdgeRuntime").waitUntil(started);' : "    await started;"}
  }

  return response;
});
`;
}

export function supabaseFiles(options: {
  readonly bundle: string;
}): Readonly<Record<string, string>> {
  return {
    "supabase/config.toml": `[functions.${functionName}]\nverify_jwt = false\nentrypoint = "./functions/${functionName}/index.js"\n`,
    [`supabase/functions/${functionName}/index.js`]: denoEntry({ waitInBackground: true }),
    [`supabase/functions/${functionName}/shadowclone-receiver.js`]: options.bundle,
  };
}

export function denoFiles(options: { readonly bundle: string }): Readonly<Record<string, string>> {
  return {
    "main.js": denoEntry({ waitInBackground: false }),
    "shadowclone-receiver.js": options.bundle,
  };
}

export function supabaseUrl(options: { readonly projectRef: string }): string {
  return `https://${options.projectRef}.supabase.co/functions/v1/${functionName}`;
}

export function denoUrl(options: { readonly app: string; readonly organization: string }): string {
  return `https://${options.app}.${options.organization}.deno.net`;
}
