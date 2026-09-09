export function profileEvidenceId(options: {
  readonly originId: string;
  readonly sessionId: string;
  readonly timestamp: number;
  readonly kind: string;
  readonly category: string;
}): string {
  return `signal:${JSON.stringify([
    options.originId,
    options.sessionId,
    options.timestamp,
    options.kind,
    options.category,
  ])}`;
}
