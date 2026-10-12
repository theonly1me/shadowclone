import { mentionNames } from "./guard/comment";
import {
  codexHome,
  codexInstallStep,
  codexProviderArguments,
  codexSetupStep,
  cursorInstallStep,
  modelArgument,
  providerKey,
  providerKeyEnvironment,
} from "./providerSteps";
import { providerEngine, type Clone } from "./types";

export const agentMinutes = 170;
export const jobMinutes = 180;

function indented(options: { readonly text: string; readonly spaces: number }): string {
  return options.text
    .split("\n")
    .map((line) => `${" ".repeat(options.spaces)}${line}`)
    .join("\n");
}

function botEmail(clone: Clone): string {
  return `${clone.botId}+${clone.botLogin}@users.noreply.github.com`;
}

function codexWorkSteps(options: {
  readonly clone: Clone;
  readonly token: string;
  readonly when: string;
  readonly version: string;
  readonly prompt: string;
  readonly environment: string;
}): string {
  const { clone, when } = options;

  return `${codexInstallStep({ version: options.version, when })}
${codexSetupStep({ clone, when })}
      - name: Give Codex the reviewed skills
        if: ${when}
        env:
          CODEX_HOME: ${codexHome}
        run: |
          mkdir -p "$CODEX_HOME/skills"
          cp -R "$SHADOWCLONE_GUIDANCE_DIRECTORY/plugins/shadowclone-personal/skills/." "$CODEX_HOME/skills/"
          cp "$SHADOWCLONE_GUIDANCE_DIRECTORY/native.md" "$CODEX_HOME/AGENTS.md"
      - name: Work with Codex
        if: ${when}
        timeout-minutes: ${agentMinutes}
        env:
          CODEX_HOME: ${codexHome}
          GH_TOKEN: ${options.token}${providerKeyEnvironment(clone)}
${options.environment}
          SHADOWCLONE_PROMPT: |
${indented({ text: options.prompt, spaces: 12 })}
        run: |
          gh auth setup-git
          git config user.name '${clone.botLogin}'
          git config user.email '${botEmail(clone)}'
          printf '%s' "$SHADOWCLONE_PROMPT" | codex exec - --skip-git-repo-check --sandbox danger-full-access -c 'approval_policy="never"' -c 'shell_environment_policy.inherit="all"'${codexProviderArguments(clone)}`;
}

function cursorWorkSteps(options: {
  readonly clone: Clone;
  readonly token: string;
  readonly when: string;
  readonly prompt: string;
  readonly environment: string;
}): string {
  const { clone, when } = options;

  return `${cursorInstallStep({ when })}
      - name: Give Cursor the reviewed skills
        if: ${when}
        run: |
          mkdir -p "$HOME/.cursor/skills" "$RUNNER_TEMP/cursor-config"
          cp -R "$SHADOWCLONE_GUIDANCE_DIRECTORY/plugins/shadowclone-personal/skills/." "$HOME/.cursor/skills/"
          printf '%s' '{"version":1,"permissions":{"allow":["Shell(*)","Read(**)","Write(**)"],"deny":[]}}' > "$RUNNER_TEMP/cursor-config/cli-config.json"
      - name: Work with Cursor
        if: ${when}
        timeout-minutes: ${agentMinutes}
        env:
          CURSOR_CONFIG_DIR: \${{ runner.temp }}/cursor-config
          GH_TOKEN: ${options.token}${providerKeyEnvironment(clone)}
${options.environment}
          SHADOWCLONE_PROMPT: |
${indented({ text: options.prompt, spaces: 12 })}
        run: |
          gh auth setup-git
          git config user.name '${clone.botLogin}'
          git config user.email '${botEmail(clone)}'
          { cat "$SHADOWCLONE_GUIDANCE_DIRECTORY/native.md"; printf '\\n\\n%s' "$SHADOWCLONE_PROMPT"; } | cursor-agent --print --force --trust --output-format text --workspace "$GITHUB_WORKSPACE"${modelArgument({ clone, flag: "--model" })}`;
}

function claudeWorkStep(options: {
  readonly clone: Clone;
  readonly token: string;
  readonly when: string;
  readonly pin: string;
  readonly prompt: string;
  readonly environment: string;
}): string {
  const { clone } = options;

  return `      - uses: ${options.pin}
        if: ${options.when}
        timeout-minutes: ${agentMinutes}
        env:
${options.environment}
        with:
          github_token: ${options.token}
          anthropic_api_key: ${providerKey(clone)}
          bot_id: '${clone.botId}'
          bot_name: '${clone.botLogin}'
          allowed_bots: '${[...new Set([...clone.reviewerBots, "github-actions[bot]"])].join(",")}'
          trigger_phrase: '@${mentionNames(clone)[0]}'
          plugin_marketplaces: \${{ env.SHADOWCLONE_GUIDANCE_DIRECTORY }}
          plugins: shadowclone-personal@shadowclone-personal
          claude_args: '--permission-mode acceptEdits --allowedTools Bash,Skill --append-system-prompt-file \${{ env.SHADOWCLONE_GUIDANCE_DIRECTORY }}/native.md${modelArgument({ clone, flag: "--model" }).replaceAll("'", "")}'
          prompt: |
${indented({ text: options.prompt, spaces: 12 })}
          display_report: false
          show_full_output: false`;
}

export function saveWorkStep(options: {
  readonly clone: Clone;
  readonly token: string;
  readonly when: string;
}): string {
  const { clone } = options;

  return `      - name: Save unfinished work to the branch
        if: always() && ${options.when}
        env:
          GH_TOKEN: ${options.token}
          BRANCH: \${{ steps.validate.outputs.branch }}
          ENTITY: \${{ steps.validate.outputs.entity }}
        run: |
          if [ "$BRANCH" = '${clone.defaultBranch.replaceAll("'", "")}' ] || [ "$(git branch --show-current)" != "$BRANCH" ]; then exit 0; fi
          if gh api "repos/${clone.repository}/issues/$ENTITY" --jq '.labels[].name' | grep -qx 'shadowclone:paused'; then exit 0; fi
          git add -A
          git diff --cached --quiet || git -c user.name='${clone.botLogin}' -c user.email='${botEmail(clone)}' commit --quiet -m "chore: save unfinished shadowclone work"
          git push --quiet "https://x-access-token:\${GH_TOKEN}@github.com/${clone.repository}.git" "HEAD:refs/heads/$BRANCH" || echo "::warning::The unfinished work could not be pushed to $BRANCH."`;
}

export function agentWorkSteps(options: {
  readonly clone: Clone;
  readonly token: string;
  readonly when: string;
  readonly claudePin: string;
  readonly codexVersion: string;
  readonly prompt: string;
  readonly environment: string;
}): string {
  const shared = { clone: options.clone, token: options.token, when: options.when, prompt: options.prompt, environment: options.environment };
  const engine = providerEngine(options.clone.provider);

  return engine === "claude"
    ? claudeWorkStep({ ...shared, pin: options.claudePin })
    : engine === "codex"
      ? codexWorkSteps({ ...shared, version: options.codexVersion })
      : cursorWorkSteps(shared);
}
