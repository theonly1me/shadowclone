import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

const pairingAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function newIdentifier(): string {
  return randomBytes(12).toString("base64url");
}

export function newPairingCode(): string {
  const characters = Array.from(
    { length: 8 },
    () => pairingAlphabet[randomInt(pairingAlphabet.length)] ?? "A",
  );

  return `${characters.slice(0, 4).join("")}-${characters.slice(4).join("")}`;
}

export function normalPairingCode(value: string): string {
  return value.toUpperCase().replaceAll(/[^A-Z0-9]/g, "");
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function sameText(options: { readonly left: string; readonly right: string }): boolean {
  const left = Buffer.from(options.left);
  const right = Buffer.from(options.right);

  return left.length === right.length && timingSafeEqual(left, right);
}
