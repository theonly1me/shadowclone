export function syntheticNativePacket(bytes: number): string {
  const start = "SHADOWCLONE_SYNTHETIC_PACKET_BEGIN\n";
  const end = "\nSHADOWCLONE_SYNTHETIC_PACKET_END";
  const content =
    "Synthetic guidance is used only to verify native context delivery.\n";
  const remaining = bytes - Buffer.byteLength(start + end);

  if (!Number.isInteger(bytes) || remaining < 0) {
    throw new Error("Synthetic packet size is invalid");
  }

  return (
    start +
    content.repeat(Math.ceil(remaining / content.length)).slice(0, remaining) +
    end
  );
}

function textValues(value: unknown): readonly string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(textValues);
  }

  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(textValues);
  }

  return [];
}

export function nativePacketObservation(options: {
  body: unknown;
  packet: string;
  forbidden: string;
}) {
  const texts = textValues(options.body);
  const count = (needle: string) =>
    texts.reduce((sum, value) => sum + value.split(needle).length - 1, 0);
  const exactCopies = count(options.packet);
  const starts = count("SHADOWCLONE_SYNTHETIC_PACKET_BEGIN");
  const ends = count("SHADOWCLONE_SYNTHETIC_PACKET_END");

  return {
    exactCopies,
    starts,
    ends,
    forbiddenCopies: count(options.forbidden),
    completeOnce: exactCopies === 1 && starts === 1 && ends === 1,
  };
}
