import os from "node:os";

type RedactionRule = {
  readonly label: string;
  readonly pattern: RegExp;
  readonly replacement: string;
};

const redactionRules: readonly RedactionRule[] = [
  {
    label: "pem-block",
    pattern: /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g,
    replacement: "[redacted:pem-block]",
  },
  {
    label: "authorization-header",
    pattern: /(Authorization\s*:\s*)(?:Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]+/gi,
    replacement: "$1[redacted:authorization]",
  },
  {
    label: "llm-api-key",
    pattern: /\bsk-[A-Za-z0-9_-]{12,}/g,
    replacement: "[redacted:llm-api-key]",
  },
  {
    label: "github-token",
    pattern: /\b(?:gh[porsu]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g,
    replacement: "[redacted:github-token]",
  },
  {
    label: "slack-token",
    pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
    replacement: "[redacted:slack-token]",
  },
  {
    label: "aws-access-key-id",
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    replacement: "[redacted:aws-access-key-id]",
  },
  {
    label: "jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g,
    replacement: "[redacted:jwt]",
  },
  {
    label: "secret-assignment",
    pattern:
      /\b([A-Za-z_][A-Za-z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|CREDENTIALS)[A-Za-z0-9_]*)(\s*=\s*)(?:"[^"\n]+"|'[^'\n]+'|[^\s"'[\n]+)/gi,
    replacement: "$1$2[redacted:secret-assignment]",
  },
] as const;

export function redactSecrets(options: { text: string; homeDirectory?: string }): string {
  const homeDirectory = options.homeDirectory ?? os.homedir();

  let redacted = options.text;
  for (const rule of redactionRules) {
    redacted = redacted.replace(rule.pattern, rule.replacement);
  }

  return homeDirectory ? redacted.replaceAll(homeDirectory, "~") : redacted;
}

export const redactionLabels: readonly string[] = redactionRules.map((rule) => rule.label);
