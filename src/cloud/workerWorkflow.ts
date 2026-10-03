import type { Clone } from "./types";

export function workerWorkflow(options: {
  readonly clone: Clone;
  readonly configured: string;
  readonly pins: {
    readonly checkout: string;
    readonly script: string;
    readonly appToken: string;
    readonly claude: string;
  };
  readonly prompt: string;
}): string {
  const { clone, configured, pins } = options;
  const guard = `${configured}
            const { resolveTrigger } = require('./.github/shadowclone/guard/events.cjs');
            const { allowWorker } = require('./.github/shadowclone/guard/policy.cjs');
            const request = github.request.bind(github);
            const trigger = await resolveTrigger({ clone: config, context, request });
            const allowed = trigger && trigger.kind !== 'pause' &&
              await allowWorker({ clone: config, context, request, trigger });

            core.setOutput('allowed', allowed ? 'true' : 'false');

            if (allowed) {
              for (const [name, value] of Object.entries(trigger)) {
                core.setOutput(name, String(value));
              }
            }`;

  return `name: Shadowclone
run-name: 'Shadowclone \${{ inputs.branch }} [\${{ inputs.key }}]'
on:
  workflow_dispatch:
    inputs:
      source: { required: true, type: string }
      identifier: { required: true, type: string }
      entity: { required: true, type: string }
      branch: { required: true, type: string }
      head: { required: false, type: string }
      key: { required: true, type: string }
      action: { required: false, type: string }
permissions:
  contents: read
  issues: read
  pull-requests: read
  actions: read
jobs:
  guard:
    if: >-
      github.repository_id == '${clone.repositoryId}' &&
      github.ref == 'refs/heads/${clone.defaultBranch.replaceAll("'", "''")}'
    runs-on: ubuntu-latest
    timeout-minutes: 3
    outputs:
      allowed: \${{ steps.validate.outputs.allowed }}
      branch: \${{ steps.validate.outputs.branch }}
    steps:
      - uses: ${pins.checkout}
        with:
          persist-credentials: false
      - uses: ${pins.script}
        id: validate
        with:
          script: |
            ${guard}
  work:
    needs: guard
    if: needs.guard.outputs.allowed == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment: shadowclone
    concurrency:
      group: shadowclone-${clone.repositoryId}-\${{ needs.guard.outputs.branch }}
      cancel-in-progress: false
    steps:
      - uses: ${pins.checkout}
        with:
          persist-credentials: false
          fetch-depth: 0
      - uses: ${pins.script}
        id: validate
        with:
          script: |
            ${guard}
      - uses: ${pins.appToken}
        id: app
        if: steps.validate.outputs.allowed == 'true'
        with:
          app-id: '${clone.appId}'
          private-key: \${{ secrets.SHADOWCLONE_APP_PRIVATE_KEY }}
          owner: '${clone.repository.split("/")[0]}'
          repositories: '${clone.repository.split("/")[1]}'
          permission-contents: write
          permission-issues: write
          permission-pull-requests: write
          permission-actions: write
          permission-checks: read
          permission-workflows: write
      - uses: ${pins.script}
        if: steps.validate.outputs.allowed == 'true'
        env:
          GUIDANCE_BUNDLE: \${{ secrets.SHADOWCLONE_GUIDANCE }}
        with:
          github-token: \${{ steps.app.outputs.token }}
          script: |
            const { restoreGuidance } = require('./.github/shadowclone/restore.cjs');
            const path = require('node:path');
            const directory = path.join(process.env.RUNNER_TEMP, 'shadowclone-guidance');
            await restoreGuidance({ encoded: process.env.GUIDANCE_BUNDLE, destination: directory });
            core.exportVariable('SHADOWCLONE_GUIDANCE_DIRECTORY', directory);

            if (String('\${{ steps.validate.outputs.kind }}') === 'pull') {
              await github.rest.issues.addLabels({
                ...context.repo,
                issue_number: Number('\${{ steps.validate.outputs.entity }}'),
                labels: ['shadowclone:managed'],
              });
            }
      - uses: ${pins.claude}
        if: steps.validate.outputs.allowed == 'true'
        env:
          SHADOWCLONE_ENTITY: \${{ steps.validate.outputs.entity }}
          SHADOWCLONE_BRANCH: \${{ steps.validate.outputs.branch }}
          SHADOWCLONE_SOURCE: \${{ steps.validate.outputs.source }}
          SHADOWCLONE_IDENTIFIER: \${{ steps.validate.outputs.identifier }}
        with:
          github_token: \${{ steps.app.outputs.token }}
          claude_code_oauth_token: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          bot_id: '${clone.botId}'
          bot_name: '${clone.botLogin}'
          allowed_bots: '${[...new Set([...clone.reviewerBots, clone.botLogin, "github-actions[bot]"])].join(",")}'
          trigger_phrase: '@shadowclone'
          plugin_marketplaces: \${{ env.SHADOWCLONE_GUIDANCE_DIRECTORY }}
          plugins: shadowclone-personal@shadowclone-personal
          claude_args: '--max-turns 60 --append-system-prompt-file \${{ env.SHADOWCLONE_GUIDANCE_DIRECTORY }}/native.md'
          prompt: |
${options.prompt
  .split("\n")
  .map((line) => `            ${line}`)
  .join("\n")}
          display_report: false
          show_full_output: false
`;
}
