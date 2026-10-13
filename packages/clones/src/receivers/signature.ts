const encoder = new TextEncoder();

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equalInConstantTime(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

export async function signBody(options: {
  readonly secret: string;
  readonly body: string;
}): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(options.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return `sha256=${hex(await crypto.subtle.sign("HMAC", key, encoder.encode(options.body)))}`;
}

export async function validSignature(options: {
  readonly secret: string;
  readonly body: string;
  readonly header: string | null;
}): Promise<boolean> {
  if (options.header === null || options.secret === "") {
    return false;
  }

  return equalInConstantTime(await signBody(options), options.header);
}
