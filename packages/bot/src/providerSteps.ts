import { providerSecrets, type Clone } from "./types";

export const codexHome = `\${{ runner.temp }}/codex-home`;

const cursorPackage = {
  version: "2026.10.01-e373342",
  url: "https://downloads.cursor.com/lab/2026.10.01-e373342/linux/x64/agent-cli-package.tar.gz",
  sha256: "a79726c6e644520e993970be4c45775a6889802b67abe461a677a53219ae28e8",
} as const;

export function providerKey(clone: Clone): string {
  return `\${{ secrets.${providerSecrets[clone.provider]} }}`;
}

export function providerKeyEnvironment(clone: Clone): string {
  return clone.provider === "cursor" ? `\n          ${providerSecrets[clone.provider]}: ${providerKey(clone)}` : "";
}

export function codexInstallStep(options: {
  readonly version: string;
  readonly when: string;
}): string {
  return `      - name: Install Codex
        if: ${options.when}
        run: |
          npm install --global --ignore-scripts --no-audit --no-fund --prefix "$RUNNER_TEMP/codex" "@openai/codex@${options.version}"
          echo "$RUNNER_TEMP/codex/bin" >> "$GITHUB_PATH"`;
}

export function codexSetupStep(options: { readonly clone: Clone; readonly when: string }): string {
  return `      - name: Sign in to Codex with the API key
        if: ${options.when}
        env:
          CODEX_HOME: ${codexHome}
          SHADOWCLONE_CODEX_KEY: ${providerKey(options.clone)}
        run: |
          mkdir -p "$CODEX_HOME"
          printenv SHADOWCLONE_CODEX_KEY | codex login --with-api-key`;
}

export function codexProviderArguments(clone: Clone): string {
  const baseUrl = clone.baseUrl === undefined ? "" : ` -c 'openai_base_url=${JSON.stringify(clone.baseUrl)}'`;

  return `${baseUrl}${modelArgument({ clone, flag: "--model" })}`;
}

export function cursorInstallStep(options: { readonly when: string }): string {
  return `      - name: Install the Cursor CLI ${cursorPackage.version}
        if: ${options.when}
        run: |
          mkdir -p "$RUNNER_TEMP/cursor"
          curl -fsSL '${cursorPackage.url}' -o "$RUNNER_TEMP/cursor.tar.gz"
          echo "${cursorPackage.sha256}  $RUNNER_TEMP/cursor.tar.gz" | sha256sum --check --quiet
          tar --strip-components=1 -xzf "$RUNNER_TEMP/cursor.tar.gz" -C "$RUNNER_TEMP/cursor"
          echo "$RUNNER_TEMP/cursor" >> "$GITHUB_PATH"`;
}

export function modelArgument(options: { readonly clone: Clone; readonly flag: string }): string {
  return options.clone.model === undefined ? "" : ` ${options.flag} '${options.clone.model}'`;
}
