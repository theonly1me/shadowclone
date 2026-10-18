import { claudeCallback, issuer, verifier, type TestHub } from "./fixtures";
import { pkceChallenge } from "./store/secret";

const formHeaders = { "Content-Type": "application/x-www-form-urlencoded" };

export async function registerClient(
  hub: TestHub,
  redirectUris: readonly string[] = [claudeCallback],
): Promise<string> {
  const response = await hub.call({
    method: "POST",
    path: "/register",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Claude", redirect_uris: redirectUris }),
  });
  const body: unknown = await response.json();

  if (
    typeof body !== "object" ||
    body === null ||
    !("client_id" in body) ||
    typeof body.client_id !== "string"
  ) {
    throw new Error(`Registration failed with ${response.status}.`);
  }

  return body.client_id;
}

export function authorizePath(options: {
  readonly clientId: string;
  readonly redirectUri?: string;
  readonly method?: string;
}): string {
  const query = new URLSearchParams({
    response_type: "code",
    client_id: options.clientId,
    redirect_uri: options.redirectUri ?? claudeCallback,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: options.method ?? "S256",
    state: "state-1",
    resource: `${issuer}/mcp`,
  });

  return `/authorize?${query}`;
}

export function consentIdOf(html: string): string {
  const match = /name="consent" value="([^"]+)"/.exec(html);

  if (match?.[1] === undefined) {
    throw new Error("The page has no consent form.");
  }

  return match[1];
}

export async function submitCode(options: {
  readonly hub: TestHub;
  readonly consentId: string;
  readonly code: string;
}): Promise<Response> {
  return options.hub.call({
    method: "POST",
    path: "/authorize",
    headers: formHeaders,
    body: new URLSearchParams({
      consent: options.consentId,
      code: options.code,
      decision: "approve",
    }).toString(),
  });
}

export async function postToken(options: {
  readonly hub: TestHub;
  readonly fields: Readonly<Record<string, string>>;
}): Promise<{ readonly status: number; readonly body: Record<string, unknown> }> {
  const response = await options.hub.call({
    method: "POST",
    path: "/token",
    headers: formHeaders,
    body: new URLSearchParams(options.fields).toString(),
  });

  return {
    status: response.status,
    body: Object.fromEntries(Object.entries(await response.json())),
  };
}

export async function connect(hub: TestHub): Promise<{
  readonly clientId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
}> {
  const clientId = await registerClient(hub);
  const page = await hub.call({ path: authorizePath({ clientId }) });
  const { code } = hub.store.createPairingCode("client");
  const approved = await submitCode({ hub, consentId: consentIdOf(await page.text()), code });
  const authorizationCode =
    new URL(approved.headers.get("Location") ?? "").searchParams.get("code") ?? "";
  const tokens = await postToken({
    hub,
    fields: {
      grant_type: "authorization_code",
      code: authorizationCode,
      client_id: clientId,
      redirect_uri: claudeCallback,
      code_verifier: verifier,
    },
  });

  return {
    clientId,
    accessToken: String(tokens.body.access_token),
    refreshToken: String(tokens.body.refresh_token),
  };
}

export function rpc(options: {
  readonly token: string;
  readonly method: string;
  readonly params?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}) {
  return {
    method: "POST",
    path: "/mcp",
    headers: {
      Authorization: `Bearer ${options.token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...options.headers,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: options.method,
      params: options.params ?? {},
    }),
  };
}
