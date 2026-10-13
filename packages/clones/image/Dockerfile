FROM node:24-bookworm-slim

ARG SHADOWCLONE_VERSION
ARG SHADOWCLONE_PACKAGE
ARG CLAUDE_CODE_VERSION=2.1.286
ARG CODEX_VERSION=0.159.0
ARG BUN_VERSION=1.4.2

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apt-get update \
  && apt-get install --yes --no-install-recommends build-essential ca-certificates curl git gnupg jq openssh-client python3 python3-venv ripgrep unzip \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install --yes --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

COPY Dockerfile *.tgz /tmp/shadowclone-build/

RUN test -n "${SHADOWCLONE_PACKAGE:-$SHADOWCLONE_VERSION}" \
  && npm install --global --no-audit --no-fund \
    "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
    "@openai/codex@${CODEX_VERSION}" \
    "bun@${BUN_VERSION}" \
    "${SHADOWCLONE_PACKAGE:-@shadowclone/cli@${SHADOWCLONE_VERSION}}" \
  && npm cache clean --force \
  && rm -rf /tmp/shadowclone-build

RUN useradd --create-home --shell /bin/bash clone \
  && mkdir -p /home/clone/.codex-login \
  && chown clone:clone /home/clone/.codex-login \
  && chmod 700 /home/clone/.codex-login

USER clone
WORKDIR /home/clone

CMD ["shadowclone", "session"]
