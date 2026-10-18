export function jsonResponse(options: {
  readonly status?: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}): Response {
  return Response.json(options.body, {
    status: options.status ?? 200,
    headers: { "Cache-Control": "no-store", ...options.headers },
  });
}

export function oauthError(options: {
  readonly status?: number;
  readonly error: string;
  readonly description: string;
}): Response {
  return jsonResponse({
    status: options.status ?? 400,
    body: { error: options.error, error_description: options.description },
  });
}

export function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export function htmlResponse(options: {
  readonly status?: number;
  readonly html: string;
  readonly formTargets?: readonly string[];
}): Response {
  const formAction = ["'self'", ...(options.formTargets ?? [])].join(" ");

  return new Response(options.html, {
    status: options.status ?? 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": `default-src 'none'; style-src 'unsafe-inline'; form-action ${formAction}; frame-ancestors 'none'; base-uri 'none'`,
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const lockedDescription =
  "The hub is locked. Run shadowclone hub unlock on the hub machine.";

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") ?? "");

  return match?.[1] ?? null;
}
