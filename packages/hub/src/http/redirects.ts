const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parsed(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function isLoopbackRedirect(value: string): boolean {
  const url = parsed(value);

  return url !== null && url.protocol === "http:" && loopbackHosts.has(url.hostname);
}

export function acceptableRedirect(value: string): boolean {
  const url = parsed(value);

  return (
    url !== null &&
    url.hash === "" &&
    url.username === "" &&
    url.password === "" &&
    (url.protocol === "https:" || isLoopbackRedirect(value))
  );
}

function withoutPort(url: URL): string {
  return `${url.protocol}//${url.hostname}${url.pathname}${url.search}`;
}

export function registeredRedirect(options: {
  readonly registered: readonly string[];
  readonly requested: string;
}): boolean {
  const requested = parsed(options.requested);

  if (requested === null) {
    return false;
  }

  return options.registered.some((entry) => {
    if (entry === options.requested) {
      return true;
    }

    const registered = parsed(entry);

    return (
      registered !== null &&
      isLoopbackRedirect(entry) &&
      isLoopbackRedirect(options.requested) &&
      withoutPort(registered) === withoutPort(requested)
    );
  });
}

export function redirectHost(value: string): string {
  return parsed(value)?.host ?? value;
}

export function redirectOrigin(value: string): string {
  return parsed(value)?.origin ?? "";
}
