export type RedactionRule = {
  readonly label: string;
  readonly pattern: RegExp;
  readonly replacement: string;
};

export const redactionRules: readonly RedactionRule[] = [
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
  {
    label: "database-url",
    pattern:
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"'`]+/gi,
    replacement: "[redacted:database-url]",
  },
  {
    label: "email-address",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[redacted:email-address]",
  },
  {
    label: "private-ip",
    pattern:
      /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/g,
    replacement: "[redacted:private-ip]",
  },
  {
    label: "internal-hostname",
    pattern: /\b(?:[a-z0-9-]+\.)+(?:internal|corp|local)\b/gi,
    replacement: "[redacted:internal-hostname]",
  },
  {
    label: "cloud-resource",
    pattern:
      /\b(?:arn:aws:[^\s"'`]+|(?:s3|gs):\/\/[a-z0-9][a-z0-9._-]{2,}[^\s"'`]*)/gi,
    replacement: "[redacted:cloud-resource]",
  },
  {
    label: "absolute-path",
    pattern:
      /(^|[\s("'=])\/(?:Users|home|private|var|opt|etc|srv|Volumes)\/[^\s"'`),]+/gm,
    replacement: "$1[redacted:absolute-path]",
  },
  {
    label: "high-entropy-string",
    pattern:
      /\b(?=[A-Za-z0-9+/_=-]{40,}\b)(?=[A-Za-z0-9+/_=-]*[A-Z])(?=[A-Za-z0-9+/_=-]*[a-z])(?=[A-Za-z0-9+/_=-]*\d)[A-Za-z0-9+/_=-]+\b/g,
    replacement: "[redacted:high-entropy-string]",
  },
] as const;
