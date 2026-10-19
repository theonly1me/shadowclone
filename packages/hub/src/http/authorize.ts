import type { HubStore } from "../store";
import type { Consent } from "../store/consents";
import { consentPage, messagePage } from "./consentPage";
import { hubScope, resourceOf } from "./metadata";
import { isLoopbackRedirect, redirectHost, redirectOrigin, registeredRedirect } from "./redirects";
import { htmlResponse, redirectResponse } from "./responses";

const challengePattern = /^[A-Za-z0-9_-]{43}$/;

const maximumForm = 4096;

function returnTo(options: {
  readonly redirectUri: string;
  readonly issuer: string;
  readonly state: string | null;
  readonly values: Readonly<Record<string, string>>;
}): Response {
  const url = new URL(options.redirectUri);

  for (const [key, value] of Object.entries(options.values)) {
    url.searchParams.set(key, value);
  }

  if (options.state !== null) {
    url.searchParams.set("state", options.state);
  }

  url.searchParams.set("iss", options.issuer);

  return redirectResponse(url.toString());
}

function stopPage(message: string): Response {
  return htmlResponse({
    status: 400,
    html: messagePage({ title: "The connection cannot continue", message }),
  });
}

function pageFor(options: {
  readonly store: HubStore;
  readonly consent: Consent;
  readonly error?: string;
}): Response {
  const client = options.store.findClient(options.consent.clientId);

  return htmlResponse({
    status: options.error === undefined ? 200 : 400,
    formTargets: [redirectOrigin(options.consent.redirectUri)],
    html: consentPage({
      consentId: options.consent.id,
      clientName: client?.name ?? "Unnamed client",
      redirectHost: redirectHost(options.consent.redirectUri),
      loopbackOnly: client?.redirectUris.every(isLoopbackRedirect) ?? false,
      ...(options.error === undefined ? {} : { error: options.error }),
    }),
  });
}

export function authorizationPage(options: {
  readonly url: URL;
  readonly store: HubStore;
  readonly issuer: string;
}): Response {
  const { url, store, issuer } = options;
  const parameter = (name: string) => url.searchParams.get(name);
  const client = store.findClient(parameter("client_id") ?? "");
  const redirectUri = parameter("redirect_uri");

  if (client === null) {
    return stopPage("The hub does not know this client. Remove the connector, and add it again.");
  }

  if (
    redirectUri === null ||
    !registeredRedirect({ registered: client.redirectUris, requested: redirectUri })
  ) {
    return stopPage("The return address does not match the address that this client registered.");
  }

  const state = parameter("state");
  const back = (values: Readonly<Record<string, string>>) =>
    returnTo({ redirectUri, issuer, state, values });
  const challenge = parameter("code_challenge");
  const resource = parameter("resource");

  if (parameter("response_type") !== "code") {
    return back({ error: "unsupported_response_type" });
  }

  if (
    parameter("code_challenge_method") !== "S256" ||
    challenge === null ||
    !challengePattern.test(challenge)
  ) {
    return back({ error: "invalid_request", error_description: "The hub needs PKCE with S256." });
  }

  if (resource !== null && resource !== resourceOf(issuer)) {
    return back({ error: "invalid_target", error_description: "The resource is not this hub." });
  }

  const consentId = store.createConsent({
    clientId: client.id,
    redirectUri,
    state,
    codeChallenge: challenge,
    scope: hubScope,
  });
  const consent = store.findConsent(consentId);

  return consent === null
    ? stopPage("The hub could not save the request.")
    : pageFor({ store, consent });
}

export async function answerAuthorization(options: {
  readonly request: Request;
  readonly store: HubStore;
  readonly issuer: string;
  readonly log: (line: string) => void;
}): Promise<Response> {
  const { store } = options;
  const text = await options.request.text();
  const form = new URLSearchParams(text.length > maximumForm ? "" : text);
  const consent = store.findConsent(form.get("consent") ?? "");

  if (consent === null) {
    return stopPage("This request expired. Start the connection again in your app.");
  }

  const back = (values: Readonly<Record<string, string>>) =>
    returnTo({
      redirectUri: consent.redirectUri,
      issuer: options.issuer,
      state: consent.state,
      values,
    });

  if (form.get("decision") !== "approve") {
    store.removeConsent(consent.id);

    return back({ error: "access_denied" });
  }

  if (!store.redeemPairingCode({ kind: "client", code: form.get("code") ?? "" })) {
    options.log("A pairing code was wrong, used, or expired.");

    return pageFor({
      store,
      consent,
      error: "The pairing code is wrong, used, or expired. A code locks after 5 wrong tries.",
    });
  }

  const code = store.approveConsent(consent);

  options.log(`Approved client ${consent.clientId} for ${redirectHost(consent.redirectUri)}.`);

  return back({ code });
}
