import { escapeHtml } from "./responses";

export function consentPage(options: {
  readonly consentId: string;
  readonly clientName: string;
  readonly redirectHost: string;
  readonly loopbackOnly: boolean;
  readonly error?: string;
}): string {
  const warning = options.loopbackOnly
    ? `<p class="warn">This client returns to a program on your own computer. Any program on that computer can claim this name. Approve only if you started this connection there.</p>`
    : "";
  const error =
    options.error === undefined ? "" : `<p class="error">${escapeHtml(options.error)}</p>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connect to your shadowclone hub</title>
<style>
body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 24px 16px; background: #f6f6f4; color: #1d1d1b; }
main { max-width: 440px; margin: 0 auto; background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 24px; }
h1 { font-size: 20px; margin: 0 0 12px; }
.host { font-family: ui-monospace, monospace; background: #f0f0ec; padding: 2px 6px; border-radius: 4px; }
.warn { background: #fff4d6; padding: 8px 12px; border-radius: 8px; }
.error { background: #fde2e1; padding: 8px 12px; border-radius: 8px; }
label { display: block; margin: 16px 0 6px; font-weight: 600; }
input { font: 20px ui-monospace, monospace; letter-spacing: 2px; width: 100%; box-sizing: border-box; padding: 8px; }
.actions { display: flex; gap: 12px; margin-top: 16px; }
button { font: inherit; padding: 8px 16px; border-radius: 8px; border: 1px solid #888; background: #fff; }
button.approve { background: #1d1d1b; color: #fff; border-color: #1d1d1b; }
@media (prefers-color-scheme: dark) {
  body { background: #161615; color: #ececea; }
  main { background: #222220; border-color: #3a3a37; }
  .host { background: #30302d; }
  .warn { background: #4a3d12; }
  .error { background: #4f1f1d; }
  button { background: #222220; color: #ececea; }
  button.approve { background: #ececea; color: #161615; }
}
</style>
</head>
<body>
<main>
<h1>Connect ${escapeHtml(options.clientName)}</h1>
<p>After you approve, <span class="host">${escapeHtml(options.redirectHost)}</span> can list your clones, start clones that work as you on GitHub, send them messages, and stop them.</p>
${warning}
${error}
<form method="post" action="/authorize">
<input type="hidden" name="consent" value="${escapeHtml(options.consentId)}">
<label for="code">Pairing code</label>
<input id="code" name="code" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="ABCD-2345">
<p>Run <span class="host">shadowclone hub pair</span> on the hub machine to get a code. A code works once, for 10 minutes.</p>
<div class="actions">
<button class="approve" type="submit" name="decision" value="approve">Approve</button>
<button type="submit" name="decision" value="deny">Deny</button>
</div>
</form>
</main>
</body>
</html>
`;
}

export function messagePage(options: { readonly title: string; readonly message: string }): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(options.title)}</title>
<style>body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 24px 16px; background: #f6f6f4; color: #1d1d1b; } main { max-width: 440px; margin: 0 auto; } @media (prefers-color-scheme: dark) { body { background: #161615; color: #ececea; } }</style>
</head>
<body><main><h1>${escapeHtml(options.title)}</h1><p>${escapeHtml(options.message)}</p></main></body>
</html>
`;
}
