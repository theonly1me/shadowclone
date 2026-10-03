import { generateKeyPairSync } from "node:crypto";
import type { App } from "./app";
import type { Repository } from "../types";

export function syntheticApp(): App {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

  return {
    id: 20,
    slug: "sample-clone",
    owner: { login: "sample" },
    pem: privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
  };
}

export const setupRepository: Repository = {
  id: 10,
  full_name: "sample/project",
  default_branch: "main",
  owner: { login: "sample", type: "User" },
  permissions: { admin: true },
};
