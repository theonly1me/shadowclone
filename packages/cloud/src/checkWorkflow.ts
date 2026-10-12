import { botToken, botTokenSteps } from "./identitySteps";
import { cursorInstallStep, providerKey } from "./providerSteps";
import type { Clone } from "./types";

export const checkWorkflowPath = ".github/workflows/shadowclone-check.yml";

function providerCheck(clone: Clone): string {
  if (clone.provider === "anthropic") {
    return `curl -fsS https://api.anthropic.com/v1/models -H "x-api-key: $PROVIDER_KEY" -H "anthropic-version: 2023-06-01" -o /dev/null`;
  }

  if (clone.provider === "openai") {
    return `curl -fsS https://api.openai.com/v1/models -H "Authorization: Bearer $PROVIDER_KEY" -o /dev/null`;
  }

  if (clone.provider === "openai-compatible") {
    return `curl -fsS '${clone.baseUrl ?? ""}/models' -H "Authorization: Bearer $PROVIDER_KEY" -o /dev/null`;
  }

  return `CURSOR_API_KEY="$PROVIDER_KEY" cursor-agent --print --trust --output-format text 'Reply with the single word ready.' > /dev/null`;
}

export function checkWorkflow(options: {
  readonly clone: Clone;
  readonly pins: { readonly checkout: string; readonly script: string };
}): string {
  const { clone, pins } = options;

  return `name: Shadowclone check
on:
  workflow_dispatch:
permissions:
  contents: read
jobs:
  check:
    if: github.repository_id == '${clone.repositoryId}'
    runs-on: ubuntu-latest
    timeout-minutes: 10
    environment: shadowclone
    steps:
${botTokenSteps({ clone, pins, when: null })}
      - name: Read the repository as ${clone.botLogin}
        env:
          GH_TOKEN: ${botToken}
        run: gh api 'repos/${clone.repository}' --jq .full_name > /dev/null
${clone.provider === "cursor" ? `${cursorInstallStep({ when: "success()" })}\n` : ""}      - name: Use the ${clone.provider} API key
        env:
          PROVIDER_KEY: ${providerKey(clone)}
        run: ${providerCheck(clone)}
`;
}
