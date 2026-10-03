import { gzipSync, gunzipSync } from "node:zlib";
import { z } from "zod";

export const bundleFileSchema = z.strictObject({
  path: z.string().regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.\/-]+$/),
  content: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/),
  mode: z.number().int().min(0).max(0o777),
});

export function encodeBundle(files: readonly z.infer<typeof bundleFileSchema>[]): string {
  const encoded = gzipSync(JSON.stringify(z.array(bundleFileSchema).parse(files))).toString(
    "base64",
  );

  if (Buffer.byteLength(encoded) > 48 * 1024) {
    throw new Error("The encoded guidance exceeds 48 KB. Select fewer skills before uploading.");
  }

  return encoded;
}

export function decodeBundle(encoded: string) {
  if (Buffer.byteLength(encoded) > 48 * 1024) {
    throw new Error("Guidance exceeds the secret limit.");
  }

  return z.array(bundleFileSchema).parse(
    JSON.parse(
      gunzipSync(Buffer.from(encoded, "base64"), {
        maxOutputLength: 8_000_000,
      }).toString(),
    ),
  );
}
