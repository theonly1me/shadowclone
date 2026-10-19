const anthropicEgressRanges = ["160.79.104.0/21"];

const tailscaleAddressRanges = ["100.64.0.0/10", "fd7a:115c:a1e0::/48"];

const loopbackRanges = ["127.0.0.0/8", "::1/128"];

export const namedSources: Readonly<Record<string, readonly string[]>> = {
  anthropic: anthropicEgressRanges,
  tailnet: tailscaleAddressRanges,
  loopback: loopbackRanges,
};

type Address = { readonly version: 4 | 6; readonly value: bigint };

function ipv4(text: string): Address | null {
  const parts = text.split(".");

  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
    return null;
  }

  return { version: 4, value: parts.reduce((total, part) => total * 256n + BigInt(part), 0n) };
}

function ipv6(text: string): Address | null {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(text);

  if (mapped?.[1] !== undefined) {
    return ipv4(mapped[1]);
  }

  const halves = text.split("::");

  if (halves.length > 2 || !/^[0-9a-f:]+$/i.test(text)) {
    return null;
  }

  const [head = "", tail = ""] = halves;
  const left = head === "" ? [] : head.split(":");
  const right = tail === "" ? [] : tail.split(":");
  const missing = 8 - left.length - right.length;

  if ((halves.length === 1 && missing !== 0) || missing < 0) {
    return null;
  }

  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right];

  if (groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) {
    return null;
  }

  return {
    version: 6,
    value: groups.reduce((total, group) => total * 65_536n + BigInt(`0x${group}`), 0n),
  };
}

export function parseAddress(text: string): Address | null {
  const trimmed = text.trim().replace(/^\[|\]$/g, "");

  return trimmed.includes(":") ? ipv6(trimmed) : ipv4(trimmed);
}

function inRange(options: { readonly address: Address; readonly range: string }): boolean {
  const [base = "", bitsText = ""] = options.range.split("/");
  const network = parseAddress(base);
  const width = options.address.version === 4 ? 32 : 128;
  const bits = bitsText === "" ? width : Number(bitsText);

  if (network === null || network.version !== options.address.version) {
    return false;
  }

  const shift = BigInt(width - bits);

  return options.address.value >> shift === network.value >> shift;
}

export function validSource(entry: string): boolean {
  if (namedSources[entry] !== undefined) {
    return true;
  }

  const [base = "", bitsText] = entry.split("/");
  const address = parseAddress(base);
  const width = address?.version === 4 ? 32 : 128;

  return (
    address !== null &&
    (bitsText === undefined || (/^\d{1,3}$/.test(bitsText) && Number(bitsText) <= width))
  );
}

export function sourceAddress(options: {
  readonly peer: string | null;
  readonly forwardedFor: string | null;
}): string | null {
  const peer = options.peer === null ? null : parseAddress(options.peer);
  const peerIsLoopback =
    peer !== null && loopbackRanges.some((range) => inRange({ address: peer, range }));
  const forwarded = options.forwardedFor?.split(",").at(-1)?.trim();

  return peerIsLoopback && forwarded !== undefined && forwarded !== "" ? forwarded : options.peer;
}

export function sourceAllowed(options: {
  readonly source: string | null;
  readonly allow: readonly string[];
}): boolean {
  if (options.allow.length === 0) {
    return true;
  }

  const address = options.source === null ? null : parseAddress(options.source);

  return (
    address !== null &&
    options.allow
      .flatMap((entry) => namedSources[entry] ?? [entry])
      .some((range) => inRange({ address, range }))
  );
}
